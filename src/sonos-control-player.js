const SonosHelper = require('./SonosHelper.js');
const helper = new SonosHelper();

module.exports = function (RED) {
  'use strict';

  /**  Create Control Player Node and subscribe to messages.
  * @param  {Object} config current node configuration data
  */
  function SonosControlPlayerNode (config) {
    RED.nodes.createNode(this, config);
    const sonosFunction = 'setup subscribe';

    const node = this;
    const configNode = RED.nodes.getNode(config.confignode);

    if (!helper.validateConfigNode(configNode)) {
      helper.nrcspFailure(node, null, new Error('n-r-c-s-p: invalid config node'), sonosFunction);
      return;
    }

    // clear node status
    node.status({});
    // subscribe and handle input message
    node.on('input', function (msg) {
      node.debug('node - msg received');

      // if ip address exist use it or get it via discovery based on serialNum
      if (!(typeof configNode.ipaddress === 'undefined' || configNode.ipaddress === null ||
        (typeof configNode.ipaddress === 'number' && isNaN(configNode.ipaddress)) || configNode.ipaddress.trim().length < 7)) {
        // exisiting ip address - fastes solution, no discovery necessary
        node.debug('using IP address of config node');
        processInputMsg(node, msg, configNode.ipaddress);
      } else {
        // have to get ip address via disovery with serial numbers
        helper.nrcspWarning(node, sonosFunction, 'No ip address', 'Providing ip address is recommended');
        if (!(typeof configNode.serialnum === 'undefined' || configNode.serialnum === null ||
                (typeof configNode.serialnum === 'number' && isNaN(configNode.serialnum)) || (configNode.serialnum.trim()).length < 19)) {
          helper.discoverSonosPlayerBySerial(node, configNode.serialnum, (err, ipAddress) => {
            if (err) {
              helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: discovery failed'), sonosFunction);
              return;
            }
            if (ipAddress === null) {
              helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: could not find any player by serial'), sonosFunction);
            } else {
              // setting of nodestatus is done in following call handelIpuntMessage
              node.debug('Found sonos player');
              processInputMsg(node, msg, ipAddress);
            }
          });
        } else {
          helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: invalid config node - invalid serial'), sonosFunction);
        }
      }
    });
  }

  // ------------------------------------------------------------------------------------

  /**  Validate sonos player and input message then dispatch further.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {string} ipaddress IP address of sonos player
  */
  function processInputMsg (node, msg, ipaddress) {
    const sonosFunction = 'handle input msg';
    // get sonos player
    const { Sonos } = require('sonos');
    const sonosPlayer = new Sonos(ipaddress);
    if (typeof sonosPlayer === 'undefined' || sonosPlayer === null ||
      (typeof sonosPlayer === 'number' && isNaN(sonosPlayer)) || sonosPlayer === '') {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined sonos player. Check configuration'), sonosFunction);
      return;
    }

    // Check msg.payload. Store lowercase version in command
    if (typeof msg.payload === 'undefined' || msg.payload === null ||
      (typeof msg.payload === 'number' && isNaN(msg.payload)) || msg.payload === '') {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined payload'), sonosFunction);
      return;
    }

    let command = String(msg.payload);
    command = command.toLowerCase();
    let commandWithParam = {};

    // dispatch
    const basicCommandList = ['play', 'pause', 'stop', 'toggleplayback', 'mute', 'unmute', 'next_song', 'previous_song', 'join_group', 'leave_group', 'activate_avtransport'];
    if (basicCommandList.indexOf(command) > -1) {
      handleCommandBasic(node, msg, sonosPlayer, command);
    } else if (command === 'play_notification') {
      handlePlayNotification(node, msg, sonosPlayer);
    } else if (command.startsWith('+')) {
      commandWithParam = { cmd: 'volume_increase', parameter: command };
      handleVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else if (command.startsWith('-')) {
      commandWithParam = { cmd: 'volume_decrease', parameter: command };
      handleVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else if (!isNaN(parseInt(command))) {
      commandWithParam = { cmd: 'volume_set', parameter: command };
      handleVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else if (command === 'set_led') {
      handleSetLed(node, msg, sonosPlayer);
      // TODO lab_ function - remove
    } else if (command === 'lab_test') {
      labTest(node, msg, sonosPlayer);
    } else {
      helper.nrcspWarning(node, sonosFunction, 'dispatching commands - invalid command', 'command-> ' + JSON.stringify(commandWithParam));
    }
  }

  // -----------------------------------------------------
  // Commands
  // -----------------------------------------------------

  /**  Handle basic commands to control sonos player.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  *                 volume valid volume
  * @param  {Object} sonosPlayer Sonos Player
  * @param  {string} cmd command - no parameter
  * @param msg.payload = true if successful
  */
  function handleCommandBasic (node, msg, sonosPlayer, cmd) {
    const sonosFunction = cmd;

    switch (cmd) {
      case 'play':
        sonosPlayer.play()
          .then(() => {
            // validate volume: integer, betweent 1 and 99 and set
            if (typeof msg.volume === 'undefined' || msg.volume === null ||
            (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
              // do NOT change volume - just return
              return true;
            }
            const newVolume = parseInt(msg.volume);
            if (Number.isInteger(newVolume)) {
              if (newVolume > 0 && newVolume < 100) {
                // change volume
                node.debug('msg.volume is in range 1...99: ' + newVolume);
                return sonosPlayer.setVolume(newVolume);
              } else {
                node.debug('msg.volume is not in range: ' + newVolume);
                throw new Error('n-r-c-s-p: msg.volume is out of range 1...99: ' + newVolume);
              }
            } else {
              node.debug('msg.volume is not number');
              throw new Error('n-r-c-s-p: msg.volume is not a number: ' + JSON.stringify(msg.volume));
            }
          })
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'stop':
        sonosPlayer.stop()
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'pause':
        sonosPlayer.pause()
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'toggleplayback':
        sonosPlayer.togglePlayback()
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'mute':
        sonosPlayer.setMuted(true)
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'unmute':
        sonosPlayer.setMuted(false)
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'next_song':
        //  CAUTION! PRERQ: there should be a next song. Only a few stations support that (example Amazon Prime)
        sonosPlayer.next()
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'previous_song':
        //  CAUTION! PRERQ: there should be a previous song. Only a few stations support that (example Amazon Prime)
        sonosPlayer.previous(false)
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'leave_group':
        sonosPlayer.leaveGroup()
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;

      case 'join_group': {
        if (typeof msg.topic === 'undefined' || msg.topic === null ||
          (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
          helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined topic', sonosFunction));
          return;
        }

        const deviceToJoing = msg.topic;
        sonosPlayer.joinGroup(deviceToJoing)
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;
      }
      case 'activate_avtransport':
        // validate msg.topic
        if (typeof msg.topic === 'undefined' || msg.topic === null ||
          (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
          helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined topic', sonosFunction));
          return;
        }

        sonosPlayer.setAVTransportURI(msg.topic)
          .then(() => { // optionally change volume
            // validate volume: integer, betweent 1 and 99
            if (typeof msg.volume === 'undefined' || msg.volume === null ||
            (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
              // do NOT change volume - just return
              return true;
            }
            const newVolume = parseInt(msg.volume);
            if (Number.isInteger(newVolume)) {
              if (newVolume > 0 && newVolume < 100) {
                // change volume
                node.debug('msg.volume is in range 1...99: ' + newVolume);
                return sonosPlayer.setVolume(newVolume);
              } else {
                node.debug('msg.volume is not in range: ' + newVolume);
                throw new Error('n-r-c-s-p: msg.volume is out of range 1...99: ' + newVolume);
              }
            } else {
              node.debug('msg.volume is not number');
              throw new Error('n-r-c-s-p: msg.volume is not a number: ' + JSON.stringify(msg.volume));
            }
          })
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;
    }
  }

  /**  Send set/adjust volume command to sonos player.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  * @param  {Object} commandObject command - cmd and parameter both as string or volume as integer
  * special: volume range 1.. 99, adjust volume rage -29 ..  +29
  */
  function handleVolumeCommand (node, msg, sonosPlayer, commandObject) {
    const sonosFunction = commandObject.cmd;
    const volumeValue = parseInt(commandObject.parameter); // convert to integer
    switch (commandObject.cmd) {
      case 'volume_set':
        if (Number.isInteger(volumeValue)) {
          if (volumeValue > 0 && volumeValue < 100) {
            node.debug('is in range:' + volumeValue);
          } else {
            helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: volume is out of range: ' + String(volumeValue)));
            return;
          }
        } else {
          helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: volume is not valid number: ' + volumeValue));
          return;
        }
        sonosPlayer.setVolume(volumeValue)
          .then(helper.nrcspSuccess(node, msg, sonosFunction))
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;
      case 'volume_decrease':
      case 'volume_increase':
        if (Number.isInteger(volumeValue)) {
          if (volumeValue > -30 && volumeValue < 30) {
            node.debug('is in range ' + volumeValue);
          } else {
            helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: volume is out of range: ' + String(volumeValue)));
            return;
          }
        } else {
          helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: volume is not valid number: ' + volumeValue));
          return;
        }
        sonosPlayer.adjustVolume(volumeValue)
          .then(() => {
            msg.payload = true;
            helper.nrcspSuccess(node, msg, sonosFunction);
            return true;
          })
          .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
        break;
    }
  }

  /**  Play Notification.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  *                 topic valid topic lab_play_uri
  *                 volume valide volume to set
  * @param  {Object} sonosPlayer Sonos Player
  * uses msg.topic (uri) and optional msg.volume (default is 40)
  */
  function handlePlayNotification (node, msg, sonosPlayer) {
    const sonosFunction = 'play notification';
    // validate msg.topic.
    if (typeof msg.topic === 'undefined' || msg.topic === null ||
      (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined topic'), sonosFunction);
      return;
    }
    // validate msg.volume - use default as backup
    let notificationVolume;
    const defaultVolume = 40;
    if (typeof msg.volume === 'undefined' || msg.volume === null ||
      (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
      notificationVolume = defaultVolume; // default
    } else {
      notificationVolume = parseInt(msg.volume);
      if (Number.isInteger(notificationVolume)) {
        if (notificationVolume > 0 && notificationVolume < 100) {
          node.debug('is in range ' + notificationVolume);
        } else {
          node.debug('is not in range: ' + notificationVolume);
          notificationVolume = defaultVolume;
          helper.nrcspWarning(node, sonosFunction, 'volume value out of range - set to default', 'value-> ' + JSON.stringify(notificationVolume));
        }
      } else {
        node.debug('is not number');
        notificationVolume = defaultVolume;
        helper.nrcspWarning(node, sonosFunction, 'invalid volume - set to default', 'value-> ' + JSON.stringify(notificationVolume));
      }
    }
    const uri = String(msg.topic).trim();
    node.debug('notification volume ' + String(notificationVolume));
    sonosPlayer.playNotification(
      {
        uri: uri,
        onlyWhenPlaying: false,
        volume: notificationVolume // Change the volume for the notification, and revert back afterwards.
      })
      .then(() => {
        msg.payload = true;
        helper.nrcspSuccess(node, msg, sonosFunction);
        return true;
      })
      .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction))
      .finally(() => node.debug('process id- finally ' + process.pid));
  }

  /**  Set LED On or Off.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  *             topic: On | Off
  * @param  {Object} sonosPlayer Sonos Player
  * @output none
  */
  function handleSetLed (node, msg, sonosPlayer) {
    const sonosFunction = 'set LED';
    // validate msg.topic.
    if (typeof msg.topic === 'undefined' || msg.topic === null ||
      (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined topic'), sonosFunction);
      return;
    }
    if (!(msg.topic === 'On' || msg.topic === 'Off')) {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: topic must be On or Off'), sonosFunction);
      return;
    }

    sonosPlayer.setLEDState(msg.topic)
      .then(() => {
        msg.payload = true;
        helper.nrcspSuccess(node, msg, sonosFunction);
        return true;
      })
      .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
  }

  /**  LAB: Test new features, error messsages, ...
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  */
  function labTest (node, msg, sonosPlayer) {
    const sonosFunction = 'lab test';
    // Check msg.topic.
    if (typeof msg.topic === 'undefined' || msg.topic === null ||
      (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
      helper.nrcspFailure(node, msg, new Error('n-r-c-s-p: undefined topic', sonosFunction));
      return;
    }
    const uri = String(msg.topic).trim();
    node.debug('starting setAVTransportURI');
    sonosPlayer.setAVTransportURI(uri)
      .then(() => {
        msg.payload = true;
        helper.nrcspSuccess(node, msg, sonosFunction);
        return true;
      })
      .catch(error => helper.nrcspFailure(node, msg, error, sonosFunction));
  }
  RED.nodes.registerType('sonos-control-player', SonosControlPlayerNode);
};
