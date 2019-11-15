# node-red-contrib-sonos-plus
[![Dependencies](https://david-dm.org/hklages/node-red-contrib-sonos-plus.svg)](https://david-dm.org/hklages/node-red-contrib-sonos-plus)
[![npm](https://img.shields.io/npm/dt/node-red-contrib-sonos-plus.svg)](https://www.npmjs.com/package/node-red-contrib-sonos-plus)
[![npm](https://img.shields.io/npm/v/node-red-contrib-sonos-plus.svg)](https://www.npmjs.com/package/node-red-contrib-sonos-plus)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/hklages/node-red-contrib-sonos-plus/master/LICENSE)

A set of [Node-RED](https://nodered.org/) nodes to control [SONOS](https://www.sonos.com/) player in your local network. Works well with [RedMatic](https://github.com/rdmtc/RedMatic/blob/master/README.en.md)

## NEWS - will be available in npm / Node-RED on 2019-12-01

Node Manage Queue: Support for Spotify: tracks, album, playlists from My Sonos or direct insertion

Node Manage Queue: Removed property: queue_length, available_playlists

Node Get Status: Added command test to check whether player is reachable

Node Control Player: Now with output to be able to chain commands

All Nodes: Revised, code simplification, ...

Node Get Status: Revised, changing some output properties name: sonosName, sonosGroup, normalized_volume, queue_active

Node Manage Radio: Bug fix - no output for play_mysonons

Node Manage Queue: Added insert_amazonprime_playlist, get_amazonprime_playlists

Node Control Player: Added set_led command


## Installation

Install directly from your NodeRED's setting pallete.

## Special Functions

- SONOS Player: Simply select SONOS player in ConfigNode by search button (recommendation: enter IP address)
- Stations: Convenient selection of "My Sonos" radio stations from TuneIn, Amazon Prime, Internet radios stations by name (search string in station name).
- TuneIn radio ID: Select and play TuneIn stations by simply submitting the TuneIn radio id
- Spotify: Insert playlists, albums, songs from My Sonos via searsch string or direct as uri
- Playlists: Insert Music Libary playlist or Sonos playlists by name (search string in playlist name)
- Playlists: Insert Amazon Prime from My Sonos by using name (search string in name)
- Notification: Interrupt current song and play an notification
- Test: Test command to check wheter SONOS player is reachable ( means on and really a SONOS player)
- Information: Provides many kinds of current song information: artist, title, media information and radio station name

## Restrictions

> When playing a radio station the commands next_song, previous_song may cause an error message as many stations do not support them.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Usage ...
For more information - also examples - see the [Wiki](https://github.com/hklages/node-red-contrib-sonos-plus/wiki)


## Credentials

[node-sonos api team](https://github.com/bencevans/node-sonos)

[node-red-better-sonos team](https://github.com/originallyus/node-red-contrib-better-sonos)
