'use strict';

var util = require('../util');
var MusicDataMixin = require('./MusicDataMixin');
var Duration = require('./Duration');

/**
 * @class
 * @param {rest} rest
 * @mixes MusicDataMixin
 * @mixes MusicDataLayoutMixin
 */
function Rest(rest) {
  util.extend(this, rest);
}

util.defineProperties(Rest.prototype,
/** @lends Rest# */
{
  /**
   * Type of rest.
   * @constant
   * @default rest
   */
  $type: { constant: 'rest' },

  /**
   * Duration of the rest.
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

  beams: {
    get: function () {
      return this._beams || (this._beams = []);
    },
    set: function (beams) {
      this._beams = beams;
    }
  },

  /**
   * Convert the rest to musje source code string.
   * @return {string} Converted musje source code.
   */
  toString: function () {
    return '0' + this.duration;
  },

  toJSON: util.makeToJSON({
    duration: undefined,
  }, 'rest')
});

util.defineProperties(Rest.prototype, MusicDataMixin);

module.exports = Rest;
