'use babel'

import { CompositeDisposable } from 'atom'
import core from 'resolve/lib/core.json'
import position from 'file-position'
import eval from 'static-eval'
import esprima from 'esprima-fb'
import resolve from 'resolve'
import clone from 'clone'
import path from 'path'
import astw from 'astw'


let isRequire = (word) => {
  word = word || 'require'

  return function(node) {
    var c = node && node.callee
    return c
      && c.name === word
      && c.type === 'Identifier'
      && node.type === 'CallExpression'
  }
}

let overlap = (a, b) => {
    if (a.end >= b.start && a.start <= b.start) return true
    if (b.end >= a.start && b.start <= a.start) return true
    if (a.start <= b.start && a.end >= b.end) return true
    if (b.start <= a.start && b.end >= a.end) return true
}

let getIndex = (lookup, range, off) => {
    off = off || 0
    return {
        start: lookup((range.start.row || range.start.line) + off, range.start.column)
        , end: lookup((range.end.row || range.end.line) + off, range.end.column)
    }
}

export default {
    subscriptions: null
    , activate() {
        this.subscriptions = new CompositeDisposable()

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-text-editor'
            , 'node-resolve:open-module'
            , () => {
                let editor = atom.workspace.getActiveTextEditor()
                    , ranges = editor.getSelectedBufferRanges().slice()
                    , buffer = editor.getBuffer()
                    , fpn = editor.getPath()
                    , src = buffer.getText()
                    , ast = esprima.parse(src, {
                        loc: true
                    })
                    , lookup = position(src)
                    , dir = path.dirname(fpn)
                    , env = {
                        __dirname: dir
                        , __filename: fpn
                    }
                astw(ast)(function(node) {
                    if (!isRequire(node)) return
                    if (!node.arguments) return
                    if (!node.arguments.length) return

                    var dst = node.evalled = node.evalled || eval(node.arguments[0], env)
                    if (!dst) return
                    if (core.indexOf(dst) !== -1) return

                    var included = false

                    for (var i = 0; i < ranges.length; i++) {
                        var loc = clone(node.loc)
                        loc.start.line--
                            loc.end.line--
                            var a = getIndex(lookup, ranges[i])
                        var b = getIndex(lookup, loc)
                        if (included = overlap(a, b)) break
                    }

                    if (!included) return

                    resolve(dst, {
                        basedir: dir
                    }, function(err, result) {
                        if (err) throw err
                        return atom.workspace.open(result)
                    })
                })
            }))

    }
    , deactivate() {
        this.subscriptions.dispose();
    }
}
