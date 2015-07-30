/*global Snap*/

var musje = musje || {};

(function (Snap) {
  'use strict';

  var objExtend = musje.objExtend;

  function near(a, b, epsilon) {
    epsilon = epsilon || 0.00001;
    return Math.abs(a - b) < epsilon;
  }

  function getBBoxAfterTransform(container, bbox, matrix) {
    var
      rect = container.rect(bbox.x, bbox.y, bbox.width, bbox.height),
      g = container.g(rect);

    rect.transform(matrix);
    bbox = g.getBBox();
    g.remove();
    return bbox;
 }

  function drawBBox(el) {
    var bb = el.getBBox();
    el.paper.rect(bb.x, bb.y, bb.width, bb.height)
      .addClass('bbox');
  }

  function drawBoxBolder(box) {
    box.rect(0, 0, box.width, box.height).addClass('bbox');
  }

  function drawMusicDataBolder(useEl, el) {
    var x = +useEl.attr('x'), y = +useEl.attr('y');
    useEl.parent().rect(x, y - el.height, el.width, el.height).addClass('bbox');
  }

  // =====================================================================

  // @constructor
  function PitchDef(svg, id, pitch, underbar, lo) {
    var
      el = this.el = svg.g().attr('id', id),
      accidentalUnicode = pitch.accidentalUnicode,
      matrix,
      sbbox,
      pbbox;

    this._lo = lo;
    this._addAccidental(accidentalUnicode);
    this._addStep(pitch.step);
    this._addOctave(pitch.octave);

    matrix = this._getTransformMatrix(accidentalUnicode, pitch.octave, underbar);
    el.transform(matrix);

    sbbox = this._sbbox;
    sbbox = getBBoxAfterTransform(this.el, sbbox, matrix);

    pbbox = el.getBBox();
    el.toDefs();

    objExtend(this, {
      width: pbbox.width,
      height: -pbbox.y,
      stepY: sbbox.y,
      stepCy: sbbox.cy,
      stepY2: sbbox.y2
    });
  }
  PitchDef.prototype._addAccidental = function (accidentalUnicode) {
    this._accidentalEndX = !accidentalUnicode ? 0 :
            this.el
              .text(0, -this._lo.accidentalShift, accidentalUnicode)
              .attr('font-size', this._lo.accidentalFontSize)
              .getBBox().x2;
  };

  PitchDef.prototype._addStep = function (step) {
    this._sbbox = this.el
      .text(this._accidentalEndX, 0, step)
      .attr('font-size', this._lo.fontSize)
      .getBBox();
  };

  PitchDef.prototype._addOctave = function (octave) {
    if (!octave) { return; }

    var
      lo = this._lo,
      octaveRadius = lo.octaveRadius,
      octaveOffset = lo.octaveOffset,
      octaveSep = lo.octaveSep,
      octaveEl = this.el.g(),
      i;

    if (octave > 0) {
      for (i = 0; i < octave; i++) {
        octaveEl.circle(this._sbbox.cx, this._sbbox.y + octaveOffset - octaveSep * i, octaveRadius);
      }
    } else {
      for (i = 0; i > octave; i--) {
        octaveEl.circle(this._sbbox.cx, this._sbbox.y2 - octaveOffset - octaveSep * i, octaveRadius);
      }
    }
    this.el.add(octaveEl);
  };

  // Transform the pitch to be in a good baseline position and
  // scale it to be more square.
  PitchDef.prototype._getTransformMatrix = function (hasAccidental, octave, underbar) {
    var
      lo = this._lo,
      pbbox = this.el.getBBox(),
      absOctave = Math.abs(octave);

    return Snap.matrix().translate(
        -pbbox.x,
        (octave >= 0 && underbar === 0 ? -lo.stepBaselineShift : 0) -
                            underbar * lo.underbarSep
      ).scale(
        Math.pow(0.97, absOctave + underbar + (hasAccidental ? 3 : 0)),
        Math.pow(0.95, absOctave + underbar + (hasAccidental ? 1 : 0))
      ).translate(
        0,
        near(pbbox.y2, this._sbbox.y2) ? 0 : -pbbox.y2
      );
  };

  // @constructor
  function Defs(svg, layoutOptions) {
    this._svg = svg;
    this._lo = layoutOptions;
  }
  Defs.prototype.get = function (musicData) {
    var id = musicData.defId;
    return this[id] || (this[id] = this._make(id, musicData));
  };

  Defs.prototype._make = function (id, musicData) {
    var
      n = musicData.__name__,
      maker = '_make' + n.charAt(0).toUpperCase() + n.substr(1);
    return this[maker](id, musicData);
  };
  Defs.prototype._makeTime = function (id, time) {
    var
      svg = this._svg,
      lo = this._lo,
      timeFontSize = lo.timeFontSize,
      lineExtend = timeFontSize * 0.1,
      el = svg.g(
          svg.text(0, -1 * timeFontSize, time.beats),
          svg.text(0, 0, time.beatType)   // baseline y = 0
        )
        .attr({
          id: id,
          fontSize: timeFontSize,
          fontWeight: lo.timeFontWeight,
          textAnchor: 'middle'
        }),
      bb = el.getBBox(),
      lineY = -0.85 * timeFontSize;

    el.line(bb.x - lineExtend, lineY, bb.x2 + lineExtend, lineY);
    el.transform(Snap.matrix().scale(1, 0.8).translate(lineExtend - bb.x, 0));
    bb = el.getBBox();
    el.toDefs();

    return {
      el: el,
      width: bb.width,
      height: -bb.y
    };
  };
  var addDot = function (el, x, dot, type, lo) {
    if (dot > 0) {
      x += lo.dotOffset * (type === 1 ? 1.2 : 1);
      el.circle(x, 0, lo.dotRadius);
    }
    if (dot > 1) {
      x += lo.dotSep * (type === 1 ? 1.2 : 1);
      el.circle(x, 0, lo.dotRadius);
    }
    return x + lo.typebarExt;
  };
  Defs.prototype._makeT1Duration = function (id, dot, type) {
    var
      lo = this._lo,
      el = this._svg.g().attr('id', id).toDefs(),
      width;

    el.path(Snap.format('M{off},0h{w}m{sep},0h{w}m{sep},0h{w}', {
      off: lo.typebarOffset,
      w: lo.typebarLength,
      sep: lo.typebarSep
    })).attr({
      stroke: 'black',
      strokeWidth: lo.typeStrokeWidth,
      fill: 'none'
    });

    width = addDot(el, lo.typebarOffset + 3 * lo.typebarLength + 2 * lo.typebarSep, dot, type, lo);

    return {
      el: el,
      width: width,
      minWidth: width,
      maxWidth: width
    };
  };
  Defs.prototype._makeT2Duration = function (id, dot, type) {
    var
      lo = this._lo,
      el = this._svg.g().attr('id', id).toDefs(),
      x = lo.typebarOffset + lo.typebarLength,
      width;

    el.line(lo.typebarOffset, 0, x, 0)
      .attr('stroke-width', lo.typeStrokeWidth);

    width = addDot(el, x, dot, type, lo);

    return {
      el: el,
      width: width,
      minWidth: width,
      maxWidth: width
    };
  };
  Defs.prototype._makeDuration = function (id, duration) {

    // only make def el for:
    // id = d41, d42, d20, d21, d20, d40, d41, d40
    switch (duration.type) {
    case 4:   // quartor note
      // TODO
      break;
    case 2:   // half note
      return this._makeT2Duration(id, duration.dot, 2);
    case 1:   // whole note
      return this._makeT1Duration(id, duration.dot, 1);
    default:   // other note types
      // TODO
    }

    return { width: 0 };
  };
  Defs.prototype._makeNote = function (id, note) {
    var
      pitch = note.pitch,
      underbar = note.duration.underbar,
      pitchId = pitch.defId + underbar,
      pitchDef = this._getPitch(pitchId, pitch, underbar),
      durationDef = this.get(note.duration);

    return {
      pitchDef: pitchDef,
      durationDef: durationDef,
      height: pitchDef.height,
      width: pitchDef.width + durationDef.width,
      minWidth: pitchDef.width + durationDef.minWidth,
      maxWidth: pitchDef.width + durationDef.maxWidth
    };
  };
  Defs.prototype._getPitch = function (id, pitch, underbar) {
    return this[id] ||
        (this[id] = new PitchDef(this._svg, id, pitch, underbar, this._lo));
  };



  // ======================================================================

  function makeBody(svg, lo) {
    var
      body = svg.g()
        .transform(Snap.matrix().translate(lo.marginLeft, lo.marginTop))
        .addClass('mus-body'),
      width = lo.width - lo.marginLeft - lo.marginRight,
      height = lo.height - lo.marginTop - lo.marginBottom;

    return objExtend(body, {
      x: 0, y: 0, cx: width / 2, cy: height / 2,
      x2: width, width: width,
      y2: height, height: height
    });
  }

  function renderHeader(score, body, lo) {
    var
      header = body.g(
          body.text(body.cx, lo.titleFontSize, score.head.title)
            .attr({
              fontSize: lo.titleFontSize,
              fontWeight: lo.titleFontWeight,
              textAnchor: 'middle'
            }),
          body.text(body.x2, lo.titleFontSize * 1.5, score.head.composer)
            .attr({
              fontSize: lo.composerFontSize,
              fontWeight: lo.composerFontWeight,
              textAnchor: 'end'
            })
        ).addClass('mus-header'),
      height = header.getBBox().height;

    // Geometry is defined inside the body frame.
    return objExtend(header, {
      x: 0, y: 0, cx: body.cx, cy: height / 2,
      x2: body.x2, width: body.width,
      y2: height, height: height
    });
  }

  function makeContent(body, header, lo) {
    var
      yOffset = header.y2 + lo.headerSep,
      height = body.height - yOffset,
      content = body.g()
        .transform(Snap.matrix().translate(0, yOffset))
        .addClass('mus-content');

    return objExtend(content, {
      x: 0, y: 0, cx: body.cx, cy: height / 2,
      x2: body.x2, width: body.width,
      y2: height, height: height
    });
  }

  function walkMusicData(score, callback) {
    score.parts.forEach(function (part, partIdx) {
      part.measures.forEach(function (measure, measureIdx) {
        measure.forEach(function (musicData, musicDataIdx) {
          callback(musicData, musicDataIdx, measureIdx, partIdx);
        });
      });
    });
  }



  musje.render = function (score, svg, lo) {
    lo = objExtend(musje.layoutOptions, lo);
    svg = Snap(svg).attr({ width: lo.width, height: lo.height });
    svg.clear();

    var
      defs = new Defs(svg, lo),
      body = makeBody(svg, lo),
      header = renderHeader(score, body, lo),
      content = makeContent(body, header, lo);

    // drawBoxBolder(body);
    // drawBoxBolder(header);
    // drawBoxBolder(content);

    //================================================

    var x = 0, baseline = 30;

    function renderTime(time) {
      var def = defs.get(time);
      var useEl = content.use(def.el).attr({ x: x, y: baseline });
      // drawMusicDataBolder(useEl, el);
      x += def.width + lo.musicDataSep;
    }

    function renderNote(note) {
      var def = defs.get(note);
      var pitchDef = def.pitchDef;
      var durationDef = def.durationDef;
      var useEl = content.use(pitchDef.el).attr({ x: x, y: baseline });
      // drawMusicDataBolder(useEl, def);
      var underbar = note.duration.underbar;

      x += pitchDef.width;

      if (note.duration.type < 4) {
        content.use(durationDef.el).attr({
          x: x,
          y: baseline + pitchDef.stepCy
        });
      } else if (underbar) {
        var y = baseline, x0 = x - pitchDef.width;
        for (var i = 0; i < underbar; i++) {
          content.line(x0, y, x, y)
            .attr('stroke-width', lo.typeStrokeWidth);
          y -= lo.underbarSep;
        }
      }
      x += durationDef.width + lo.musicDataSep;
    }

    content.line(x, baseline, content.width, baseline).addClass('ref-line');

    walkMusicData(score, function (data) {
      switch (data.__name__) {
      case 'note':
        renderNote(data);
        break;
      case 'time':
        renderTime(data);
        break;
      }
    });

    // console.log(defs['n1010'].durationDef.el.attr('id'))

  };

}(Snap));