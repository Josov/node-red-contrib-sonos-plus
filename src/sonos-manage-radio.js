const SonosHelper = require('./SonosHelper.js');
const helper = new SonosHelper();

module.exports = function (RED) {
  'use strict';

  function SonosManageRadioNode (config) {
    /**  Create Manage Radio Node and subscribe to messages
    * @param  {object} config current node configuration data
    */

    RED.nodes.createNode(this, config);
    const sonosFunction = 'create node manage radio';
    // verify config node. if valid then set status and subscribe to messages
    const node = this;
    const configNode = RED.nodes.getNode(config.confignode);
    const isValid = helper.validateConfigNodeV3(configNode);
    if (isValid) {
      // clear node status
      node.status({});
      // subscribe and handle input message
      node.on('input', function (msg) {
        node.debug('node on - msg received');
        // check again configNode - in the meantime it might have changed
        const isStillValid = helper.validateConfigNodeV3(configNode);
        if (isStillValid) {
          helper.identifyPlayerProcessInputMsg(node, configNode, msg, function (ipAddress) {
            if (typeof ipAddress === 'undefined' || ipAddress === null ||
              (typeof ipAddress === 'number' && isNaN(ipAddress)) || ipAddress === '') {
              // error handling node status, node error is done in identifyPlayerProcessInputMsg
            } else {
              node.debug('Found sonos player');
              handleInputMsg(node, msg, ipAddress);
            }
          });
        } else {
          helper.showError(node, new Error('n-r-c-s-p: Please modify config node'), sonosFunction, 'process message - invalid configNode');
        }
      });
    } else {
      helper.showError(node, new Error('n-r-c-s-p: Please modify config node'), sonosFunction, 'setup subscribe - invalid configNode');
    }
  }

  // ------------------------------------------------------------------------------------

  /**  Validate sonos player and input message then dispatch further.
  * @param  {Object} node current node
  * @param  {object} msg incoming message
  * @param  {string} ipaddress IP address of sonos player
  */
  function handleInputMsg (node, msg, ipaddress) {
    // get sonos player object
    const { Sonos } = require('sonos');
    const sonosPlayer = new Sonos(ipaddress);
    const sonosFunction = 'handle input msg';
    if (typeof sonosPlayer === 'undefined' || sonosPlayer === null ||
      (typeof sonosPlayer === 'number' && isNaN(sonosPlayer)) || sonosPlayer === '') {
      helper.showError(node, new Error('n-r-c-s-p: Check configuration'), sonosFunction, 'invalid sonos player.');
      return;
    }

    // Check msg.payload. Store lowercase version in command
    if (typeof msg.payload === 'undefined' || msg.payload === null ||
      (typeof msg.payload === 'number' && isNaN(msg.payload)) || msg.payload === '') {
      helper.showError(node, new Error('n-r-c-s-p: invalid payload ' + JSON.stringify(msg)), sonosFunction, 'invalid payload');
      return;
    }

    // dispatch (dont add msg.topic because may not exist and is not checked)
    // TODO use command without parameter and get topic in subprocedure
    const commandWithParam = {
      cmd: (String(msg.payload)).toLowerCase(),
      parameter: ''
    };
    if (commandWithParam.cmd === 'play_mysonos') {
      if (typeof msg.topic === 'undefined' || msg.topic === null ||
        (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
        helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
        return;
      }
      commandWithParam.parameter = String(msg.topic);
      playMySonos(node, msg, sonosPlayer, commandWithParam);
    } else if (commandWithParam.cmd === 'play_tunein') {
      if (typeof msg.topic === 'undefined' || msg.topic === null ||
        (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
        helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
        return;
      }
      commandWithParam.parameter = String(msg.topic);
      playTuneIn(node, msg, sonosPlayer, commandWithParam);
    } else if (commandWithParam.cmd === 'get_mysonos') {
      getMySonosStations(node, msg, sonosPlayer);
    } else if (commandWithParam.cmd === 'get_mysonosall') {
      getMySonosAll(node, msg, sonosPlayer);
    } else {
      helper.showWarning(node, sonosFunction, 'dispatching commands - invalid command', 'command-> ' + JSON.stringify(commandWithParam));
    }
  }

  // -----------------------------------------------------------------------------

  /**  Activate TuneIn radio station and optional set volume (via simple TuneIn Radio id).
  * @param  {Object} node current node
  * @param  {object} msg incoming message - uses msg.voluem if provided
  * @param  {object} sonosPlayer Sonos Player
  * @param  {object} commandObject command with function and parameter
  */
  function playTuneIn (node, msg, sonosPlayer, commandObject) {
    const reg = new RegExp('^[s][0-9]+$'); // example s11111
    const sonosFunction = 'play tunein';
    if (reg.test(commandObject.parameter)) {
      sonosPlayer.playTuneinRadio(commandObject.parameter)
        .then(response => {
          node.debug('response from playTuneInRadio: ' + JSON.stringify(response));
          if (typeof response.items === 'undefined' || response.items === null ||
            (typeof response.items === 'number' && isNaN(response.items)) || response.items === '') {
            helper.showError(node, new Error('n-r-c-s-p: invalid response from playTuneIn received ' + JSON.stringify(response)), sonosFunction, 'invalid response from playTuneIn received');
            return;
          }
          // set volume if provided
          if (typeof msg.volume === 'undefined' || msg.volume === null ||
            (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
            // dont touch volume
          } else {
            const newVolume = parseInt(msg.volume);
            if (Number.isInteger(newVolume)) {
              if (newVolume > 0 && newVolume < 100) {
                node.debug('is in range ' + newVolume);
                sonosPlayer.setVolume(newVolume);
              } else {
                node.debug('is not in range: ' + newVolume);
                throw new Error('n-r-c-s-p: msg.volume is out of range 1 ... 100');
              }
            } else {
              node.debug('msg.volume is not number');
              throw new Error('n-r-c-s-p: msg.volume is not a number');
            }
          }
          // update node status and send msg
          helper.showSuccess(node, sonosFunction);
          node.send(msg);
        })
        .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response or program'));
    } else {
      helper.showError(node, new Error('n-r-c-s-p: invalid tunein id'), sonosFunction, 'invalid tunein id');
    }
  }

  /**  Play a specific  My Sonos radion station (only TuneIn, AmazonPrime), start playing and optionally set volume.
  * @param  {Object} node current node
  * @param  {object} msg incoming message - uses msg.volume if provided
  * @param  {object} sonosPlayer Sonos Player
  * @param  {object} commandObject command with function and parameter
  * change msg.payload to current station title if no error occures
  */
  function playMySonos (node, msg, sonosPlayer, commandObject) {
    // get list of My Sonos stations
    const sonosFunction = 'play mysonos';
    sonosPlayer.getFavorites()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid getFavorites response received ' + JSON.stringify(response)), sonosFunction, 'invalid getqueue response received');
          return;
        }

        if (typeof response.items === 'undefined' || response.items === null ||
          (typeof response.items === 'number' && isNaN(response.items)) || response.items === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid favorite list received ' + JSON.stringify(response)), sonosFunction, 'invalid favorite list received');
          return;
        }

        // filter: Amazon Prime Playlists only
        if (!Array.isArray(response.items)) {
          helper.showError(node, new Error('n-r-c-s-p: did not receive a list' + JSON.stringify(response)), sonosFunction, 'did not receive a list');
          return;
        }

        // filter: TuneIn or Amazon Prime radio stations
        const TUNEIN_PREFIX = 'x-sonosapi-stream:';
        const AMAZON_PREFIX = 'x-sonosapi-radio:';
        const stationList = [];
        let stationUri;
        let radioId;
        for (let i = 0; i < response.items.length; i++) {
          if (response.items[i].uri.startsWith(TUNEIN_PREFIX)) {
          // get stationId
            stationUri = response.items[i].uri;
            radioId = stationUri.split('?')[0];
            radioId = radioId.substr(TUNEIN_PREFIX.length);
            stationList.push({ title: response.items[i].title, radioId: radioId, uri: stationUri, source: 'TuneIn' });
          }
          if (response.items[i].uri.startsWith(AMAZON_PREFIX)) {
            stationList.push({ title: response.items[i].title, uri: response.items[i].uri, source: 'AmazonPrime' });
          }
        }
        if (stationList.length === 0) {
          helper.showError(node, new Error('n-r-c-s-p: no TuneIn/Amazon station in my sonos'), sonosFunction, 'no TuneIn/Amazon station in my sonos');
          return;
        }

        // lookup topic in list and play radio station - first match counts
        let isInStationList = false;
        for (let i = 0; i < stationList.length; i++) {
          if (((stationList[i].title).indexOf(commandObject.parameter)) >= 0) {
            // play radion station
            isInStationList = true;
            if (stationList[i].source === 'TuneIn') {
              sonosPlayer.playTuneinRadio(stationList[i].radioId)
                .then(response => {
                  // set volume if provided
                  if (typeof msg.volume === 'undefined' || msg.volume === null ||
                    (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
                    // dont touch volume
                  } else {
                    const newVolume = parseInt(msg.volume);
                    if (Number.isInteger(newVolume)) {
                      if (newVolume > 0 && newVolume < 100) {
                        node.debug('is in range ' + newVolume);
                        sonosPlayer.setVolume(newVolume);
                      } else {
                        node.debug('is not in range: ' + newVolume);
                        throw new Error('n-r-c-s-p: msg.volume is out of range 1 ... 100');
                      }
                    } else {
                      node.debug('msg.volume is not number');
                      throw new Error('n-r-c-s-p: msg.volume is not a number');
                    }
                  }
                  // update node status and send message
                  helper.showSuccess(node, sonosFunction);
                  msg.payload = stationList[i].title;
                  node.send(msg);
                })
                .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
            } else if (stationList[i].source === 'AmazonPrime') {
              sonosPlayer.setAVTransportURI(stationList[i].uri)
                .then(response => {
                  if (typeof msg.volume === 'undefined' || msg.volume === null ||
                    (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
                    // dont touch volume
                  } else {
                    const newVolume = parseInt(msg.volume);
                    if (Number.isInteger(newVolume)) {
                      if (newVolume > 0 && newVolume < 100) {
                        node.debug('is in range ' + newVolume);
                        sonosPlayer.setVolume(newVolume);
                      } else {
                        node.debug('is not in range: ' + newVolume);
                        throw new Error('n-r-c-s-p: msg.volume is out of range 1 ... 100');
                      }
                    } else {
                      node.debug('msg.volume is not number');
                      throw new Error('n-r-c-s-p: msg.volume is not a number');
                    }
                  }
                  helper.showSuccess(node, sonosFunction);
                  msg.payload = stationList[i].title;
                  node.send(msg);
                })
                .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
            } else {
              helper.showError(node, new Error('n-r-c-s-p: Neither tuneIn nor amazon'), sonosFunction, 'Neither tuneIn nor amazon');
              return;
            }
            break;
          }
        }
        if (!isInStationList) {
          helper.showError(node, new Error('n-r-c-s-p: topic not found in my sonos list'), sonosFunction, 'topic not found in my sonos list');
        }
      })
      .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
  }

  /**  Get list of My Sonos radion station (only TuneIn, AmazonPrime).
  * @param  {Object} node current node
  * @param  {object} msg incoming message
  * @param  {object} sonosPlayer Sonos Player
  * change msg.payload to current array of my Sonos radio stations
  */
  function getMySonosStations (node, msg, sonosPlayer) {
    // get list of My Sonos stations
    const sonosFunction = 'get my sonos stations';
    sonosPlayer.getFavorites()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid getFavorites response received ' + JSON.stringify(response)), sonosFunction, 'invalid getqueue response received');
          return;
        }

        if (typeof response.items === 'undefined' || response.items === null ||
          (typeof response.items === 'number' && isNaN(response.items)) || response.items === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid favorite list received ' + JSON.stringify(response)), sonosFunction, 'invalid favorite list received');
          return;
        }

        // filter: Amazon Prime Playlists only
        if (!Array.isArray(response.items)) {
          helper.showError(node, new Error('n-r-c-s-p: did not receive a list' + JSON.stringify(response)), sonosFunction, 'did not receive a list');
          return;
        }

        // filter: TuneIn or Amazon Prime radio stations
        const TUNEIN_PREFIX = 'x-sonosapi-stream:';
        const AMAZON_PREFIX = 'x-sonosapi-radio:';
        const stationList = [];
        let stationUri;
        let radioId;
        for (let i = 0; i < response.items.length; i++) {
          if (response.items[i].uri.startsWith(TUNEIN_PREFIX)) {
          // get stationId
            stationUri = response.items[i].uri;
            radioId = stationUri.split('?')[0];
            radioId = radioId.substr(TUNEIN_PREFIX.length);
            stationList.push({ title: response.items[i].title, radioId: radioId, uri: stationUri, source: 'TuneIn' });
          }
          if (response.items[i].uri.startsWith(AMAZON_PREFIX)) {
            stationList.push({ title: response.items[i].title, uri: response.items[i].uri, source: 'AmazonPrime' });
          }
        }
        if (stationList.length === 0) {
          helper.showError(node, new Error('n-r-c-s-p: no TuneIn/Amazon station in my sonos'), sonosFunction, 'no TuneIn/Amazon station in my sonos');
          return;
        }
        helper.showSuccess(node, sonosFunction);
        msg.payload = stationList;
        node.send(msg);
      })
      .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
  }

  /**  Get list of My Sonos all items.
  * @param  {Object} node current node
  * @param  {object} msg incoming message
  * @param  {object} sonosPlayer Sonos Player
  * change msg.payload to current array of my Sonos radio stations
  */
  function getMySonosAll (node, msg, sonosPlayer) {
    // get list of My Sonos items
    const sonosFunction = 'get my sonos all';
    sonosPlayer.getFavorites()
      .then(response => {
        if (typeof response === 'undefined' || response === null ||
          (typeof response === 'number' && isNaN(response)) || response === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid getFavorites response received ' + JSON.stringify(response)), sonosFunction, 'invalid getqueue response received');
          return;
        }

        if (typeof response.items === 'undefined' || response.items === null ||
          (typeof response.items === 'number' && isNaN(response.items)) || response.items === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid favorite list received ' + JSON.stringify(response)), sonosFunction, 'invalid favorite list received');
          return;
        }

        // filter: Amazon Prime Playlists only
        if (!Array.isArray(response.items)) {
          helper.showError(node, new Error('n-r-c-s-p: did not receive a list' + JSON.stringify(response)), sonosFunction, 'did not receive a list');
          return;
        }
        const list = response.items;
        if (list.length === 0) {
          helper.showError(node, new Error('n-r-c-s-p: no my sonos items found'), sonosFunction, 'no my sonos items found');
          return;
        }
        helper.showSuccess(node, sonosFunction);
        msg.payload = list;
        node.send(msg);
      })
      .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
  }
  RED.nodes.registerType('sonos-manage-radio', SonosManageRadioNode);
};
