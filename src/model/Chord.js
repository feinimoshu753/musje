'use strict';

var util = require('../util');
var MusicDataMixin = require('./MusicDataMixin');
var Pitch = require('./Pitch');
var Duration = require('./Duration');

/**
 * @class
 * @param {Object} chord
 * @mixes MusicDataMixin
 * @mixes MusicDataLayoutMixin
 */
function Chord(chord) {
  util.extend(this, chord);
}

util.defineProperties(Chord.prototype,
/** @lends Chord# */
{
  /**
   * Type of chord.
   * @constant
   * @default chord
   */
  $type: { constant: 'chord' },

  /**
   * Pitches in the chord.
   * @type {Array.<Pitch>}
   */
  pitches: {
    get: function () {
      return this._pitches || (this._pitches = []);
    },
    set: function (pitches) {
      this._pitches = pitches.map(function (pitch) {
        return new Pitch(pitch);
      });
    }
  },

  /**
   * Duration of the chord.
   * @type {Duration}
   */
  duration: {
    get: function () {
      return this._duration || (this._duration = new Duration());
    },
    set: function (duration) {
      this._duration = new Duration(duration);
    }
  },

  /**
   * Convert chord to the musje source code string.
   * @return {string} Converted musje source code of the chord.
   */
  toString: function () {
    return '<' + this.pitches.map(function (pitch) {
      return pitch.toString();
    }).join('') + '>' + this.duration;
  },

  toJSON: util.makeToJSON({
    pitches: undefined,
    duration: undefined,
  }, 'chord')
});

util.defineProperties(Chord.prototype, MusicDataMixin);

module.exports = Chord;
