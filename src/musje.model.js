/**
 * Usage:
 * var score = musje.score(JSONString or object);
 */

var musje = musje || {};

(function () {
  'use strict';

  var push = Array.prototype.push;

  function makeSchema(model) {
    var schema = _.extend({
      $schema: 'http://json-schema.org/draft-04/schema#'
    }, model);

    function noAccessor(obj) {
      var result = _.clone(obj);
      _.each(result, function (val, key) {
        if (val.get || val.set) { delete result[key]; }
      });
      return result;
    }

    // Group of schema definitions with name: integers, objects, arrays...
    _.each(schema, function (rawGroup, groupName) {
      var newGroup;

      switch (groupName) {
      case 'integers':
        newGroup = schema.integers = {};
        _.each(rawGroup, function (val, key) {
          newGroup[key] = _.extend({ type: 'integer' }, val);
        });
        break;
      case 'root':
        delete schema.root;
        schema.type = 'object';
        schema.properties = rawGroup[_.keys(rawGroup)[0]];
        schema.additionalProperties = false;
        break;
      case 'objects':
        newGroup = schema.objects = {};
        _.each(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'object',
            properties: noAccessor(val),
            additionalProperties: false
          };
        });
        break;
      case 'namedObjects':
        newGroup = schema.namedObjects = {};
        _.each(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'object',
            properties: {},
            additionalProperties: false
          };
          newGroup[key].properties[key] = val.type ? val : {
            type: 'object',
            properties: noAccessor(val),
            additionalProperties: false
          };
        });
        break;
      case 'arrays':
        newGroup = schema.arrays = {};
        _.each(rawGroup, function (val, key) {
          newGroup[key] = {
            type: 'array',
            items: val,
            addtionalItems: false
          };
          if (_.isArray(val)) {
            newGroup[key].items = { oneOf: val };
          }
        });
        break;
      }
    });

    return schema;
  }

  function camel(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  }

  function defaultValue(model, $ref) {
    var tmp = $ref.split('/'), groupName = tmp[1], schemaName = tmp[2];
    return model[groupName] && model[groupName][schemaName] &&
           model[groupName][schemaName].default;
  }

  function getObjectName(model, $ref) {
    var tmp = $ref.split('/'), groupName = tmp[1];
    return (groupName === 'objects' || groupName === 'namedObjects' ||
            groupName === 'arrays' || groupName === 'root') &&
           tmp[2];
  }

  function makeObjectProperty(obj, propName, type) {
    var varName = '_' + propName, Constructor;

    Constructor = musje[type];
    if (!Constructor) { throw new Error('Undefined type: musje.' + type); }

    Object.defineProperty(obj, propName, {
      get: function () {
        if (this[varName] === undefined) {
          this[varName] = new Constructor();
        }
        return this[varName];
      },
      set: function (v) { this[varName] = new Constructor(v); }
    });
  }

  function defineClass(nameSpace, groupName, objectName, model) {
    var
      className = camel(objectName),
      Constructor = nameSpace[className] =  function (obj) {
        for (var key in obj) { this[key] = obj[key]; }
      },
      proto = Constructor.prototype,
      propNames = [];

    proto.__name__ = objectName;

    _.each(model[groupName][objectName], function (descriptor, propName) {
      var defaultVal, objName;

      // ES5 accessor property
      if (descriptor.get || descriptor.set) {
        Object.defineProperty(proto, propName, descriptor);

      // Default value of primitive types
      } else if (descriptor.default !== undefined) {
        proto[propName] = descriptor.default;
        propNames.push(propName);

      // Schema reference
      } else if (descriptor.$ref) {
        defaultVal = defaultValue(model, descriptor.$ref);
        objName = getObjectName(model, descriptor.$ref);
        if (defaultVal !== undefined) {
          proto[propName] = defaultVal;
        } else if (objName) {
          makeObjectProperty(proto, propName, camel(objName));
        }
        propNames.push(propName);

      // Method
      } else if (typeof descriptor === 'function') {
        proto[propName] = descriptor;
      }
    });

    if (groupName === 'namedObjects') {
      proto.toJSON = function () {
        var result = {},
          inner = result[this.__name__] = {},
          i, propName;
        for (i = 0; i < propNames.length; i++) {
          propName = propNames[i];
          inner[propName] = this[propName];
        }
        return result;
      };
    } else {
      proto.toJSON = function () {
        var result = {}, i, propName;
        for (i = 0; i < propNames.length; i++) {
          propName = propNames[i];
          result[propName] = this[propName];
        }
        return result;
      };
    }
  }

  function defineSimpleClass(nameSpace, objectName, model) {
    var
      className = camel(objectName),
      Constructor = nameSpace[className] =  function (val) {
        this.value = val;
      },
      proto = Constructor.prototype,
      defaultValue = model.namedObjects[objectName].default;

    proto.__name__ = objectName;

    _.each(model.namedObjects[objectName], function (descriptor, propName) {

      if (descriptor.default !== undefined) {
        proto.value = descriptor.default;

      // Method
      } else if (typeof descriptor === 'function') {
        proto[propName] = descriptor;
      }
    });

    proto.toJSON = function () {
      var result = {};
      result[objectName] = this.value;
      return result;
    };
  }

  function defineArrayClass(nameSpace, arrayName, model) {
    var
      className = camel(arrayName),
      schema = model.arrays[arrayName],
      constructorName;

    if (_.isArray(schema)) {
      nameSpace[className] = function (a) {
        var arr = [];
        arr.push = function () {
          _.each(arguments, function (item) {
            var propName = _.keys(item)[0],
              Constructor = nameSpace[camel(propName)];
            push.call(arr, new Constructor(item[propName]));
          });
        };
        arr.push.apply(arr, a);
        return arr;
      };
    } else {

      constructorName = camel(getObjectName(model, model.arrays[arrayName].$ref));
      nameSpace[className] = function (a) {
        var arr = [];
        arr.push = function () {
          _.each(arguments, function (item) {
            push.call(arr, new nameSpace[constructorName](item));
          });
        };
        arr.push.apply(arr, a);
        return arr;
      };
    }
  }

  function defineClasses(nameSpace, model, groupName) {
    if (groupName === 'arrays') {
      _.each(model[groupName], function (descriptor, objectName) {
        defineArrayClass(nameSpace, objectName, model);
      });
    } else {
      _.each(model[groupName], function (descriptor, objectName) {
        if (groupName === 'namedObjects' && descriptor.type) {
          defineSimpleClass(nameSpace, objectName, model);
        } else {
          defineClass(nameSpace, groupName, objectName, model);
        }
      });
    }
  }


  /**
   * Musje model definitions
   * ============================================================
   */

  var
    A4_FREQUENCY = 440,
    A4_MIDI_NUMBER = 69,
    TEMPO = 80,
    STEP_TO_MIDI_NUMBER = [null, 0, 2, 4, 5, 7, 9, 11],
    ACCIDENTAL_TO_ALTER = { '#' : 1, '##': 2, 'n': 0, 'b' : -1, 'bb': -2 },
    TYPE_TO_STRING = { 1: ' - - - ', 2: ' - ', 4: '', 8: '_', 16: '=', 32: '=_', 64: '==', 128: '==_', 256: '===', 512: '===_', 1024: '====' },
    DOT_TO_STRING = { 0: '', 1: '.', 2: '..' },
    BAR_TO_STRING = {single: '|', double: '||', end: '|]', 'repeat-begin': '|:', 'repeat-end': ':|', 'repeat-both': ':|:'};

  function chars(ch, num) {
    return new Array(num + 1).join(ch);
  }

  function octaveString(octave) {
    return octave > 0 ? chars('\'', octave) :
           octave < 0 ? chars(',', -octave) : '';
  }

  var model = {
    title: 'Musje',
    description: '123 Music score',

    root: {
      score: {
        head: { $ref: '#/objects/scoreHead' },
        parts: { $ref: '#/arrays/parts' },
        toString: function () {
          return this.head + _.map(this.parts, function (part) {
            return part.toString();
          }).join('\n\n');
        }
      }
    },

    integers: {
      beatType: {
        enum: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
        default: 4
      }
    },

    objects: {
      scoreHead: {
        title: { type: 'string' },
        composer: { type: 'string' },
        toString: function () {
          return '              <<<' + this.title + '>>>          ' +
                 this.composer + '\n';
        }
      },

      part: {
        // head: { $ref: '#/objects/partHead' },
        measures: { $ref: '#/arrays/measures' },
        toString: function () {
          return _.map(this.measures, function (measure) {
            return _.map(measure, function (musicData) {
              return musicData.toString();
            }).join(' ');
          }).join(' ');
        }
      },

      // partHead: TO BE DEFINED!,

      pitch: {
        step: {
          type: 'integer',
          minimum: 1,
          maximum: 7,
          default: 1
        },
        octave: {
          type: 'integer',
          minimum: -5,
          maximum: 5,
          default: 0
        },
        accidental: {
          type: 'string',
          enum: ['#', 'b', '', '##', 'bb'],
          default: ''
        },
        midiNumber: {
          get: function () {
            return (this.octave + 5) * 12 +
              STEP_TO_MIDI_NUMBER[this.step] +
              (ACCIDENTAL_TO_ALTER[this.accidental] || 0);
          }
        },
        frequency: {
          get: function () {
            return A4_FREQUENCY * Math.pow(2, (this.midiNumber - A4_MIDI_NUMBER) / 12);
          }
        },
        toString: function () {
          return this.accidental + this.step + octaveString(this.octave);
        }
      },

      duration: {
        type: { $ref: '#/integers/beatType' },
        dot: {
          type: 'integer',
          minimum: 0,
          maximum: 2,
          default: 0
        },
        second: {
          get: function () {
            var d = 60 / TEMPO * 4 / this.type;
            return this.dot === 0 ? d :
                   this.dot === 1 ? d * 1.5 : d * 1.75;
          }
        },
        toString: function () {
          return TYPE_TO_STRING[this.type] + DOT_TO_STRING[this.dot];
        }
      }
    },

    namedObjects: {
      time: {
        beats: {
          type: 'integer',
          default: 4
        },
        beatType: { $ref: '#/integers/beatType' },
        toString: function () {
          return this.beats + '/' + this.beatType;
        }
      },

      note: {
        pitch: { $ref: '#/objects/pitch' },
        duration: { $ref: '#/objects/duration' },
        slur: {
          type: 'array',
          items: {
            enum: ['begin', 'end']
          }
        },
        toString: function () {
          return this.pitch + this.duration;
        }
      },

      rest: {
        duration: { $ref: '#/objects/duration' },
        toString: function () {
          return '0' + this.duration;
        }
      },

      chord: {
        pitches: {
          type: 'array',
          items: { $ref: '#/objects/pitch' }
        },
        duration: { $ref: '#/objects/duration' },
        toString: function () {
          return '<' + _.map(this.pitches, function (pitch) {
            return pitch.toString();
          }).join('') + '>' + this.duration;
        }
      },

      // voice: {
      //   type: 'array',
      //   items: {
      //     oneOf: [
      //       { $ref: '#/namedObjects/note' },
      //       { $ref: '#/namedObjects/rest' },
      //       { $ref: '#/namedObjects/chord' },
      //     ]
      //   }
      // }

      bar: {
        type: 'string',
        enum: ['single', 'double', 'end', 'repeat-begin', 'repeat-end', 'repeat-both'],
        default: 'single',
        toString: function () {
          return BAR_TO_STRING[this.value];
        }
      }
    },

    arrays: {
      parts: { $ref: '#/objects/part' },
      measures: { $ref: '#/arrays/musicData' },
      musicData: [
        { $ref: '#/namedObjects/time' },
        { $ref: '#/namedObjects/note' },
        { $ref: '#/namedObjects/rest' },
        { $ref: '#/namedObjects/chord' },
        // { $ref: '#/namedObjects/voice' },
        { $ref: '#/namedObjects/bar' }
      ]
    }
  };

  musje.JSONSchema = makeSchema(model);

  musje.validate = function (obj) {
    if (typeof obj === 'string') { obj = JSON.parse(obj); }
    var result = tv4.validate(obj, musje.JSONSchema);
    musje.validate.error = tv4.error;
    musje.validate.missing = tv4.missing;
    return result;
  };

  var rootName = _.keys(model.root)[0];
  defineClasses(musje, model, 'arrays');
  defineClasses(musje, model, 'objects');
  defineClasses(musje, model, 'namedObjects');
  defineClass(musje, 'root', rootName, model);
  musje[camel(rootName)].prototype.stringify = function (replacer, space) {
    return JSON.stringify(this, replacer, space);
  }

  musje.score = function (src, validate) {
    validate = validate === undefined ? true : validate;
    if (typeof src === 'string') { src = JSON.parse(src); }
    if (validate) { musje.validate(src); }
    return new musje.Score(src);
  };

}());
