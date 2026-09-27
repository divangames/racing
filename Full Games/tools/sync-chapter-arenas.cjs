'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'content', 'tracks.js');
const dir = path.join(root, 'content', 'assets', 'data', 'tracks', 'chapters');
const context = {
  console,
  Image: function () {
    this.complete = false;
    this.naturalWidth = 0;
  }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(source, 'utf8'), context, {filename: source});

const tracks = context.RnRTracks.chapterTracks(1);
const templateFile = path.join(dir, 'ch1_arena_01.json');
const template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
for (const track of tracks) {
  const file = path.join(dir, track.id + '.json');
  const exists = fs.existsSync(file);
  const saved = exists
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : Object.assign({}, template, {decals: [], items: [], objects: [], hazards: {ramps: [], mines: [], oils: [], pads: []}});
  const first = track.cps[0];
  const second = track.cps[1];
  saved.id = track.id;
  saved.name = track.name;
  saved.raceClass = track.raceClass;
  saved.zones = track.zones;
  saved.gaps = track.gaps || [];
  saved.decks = track.decks || [];
  saved.cps = track.cps;
  saved.start = {
    x: first[0],
    y: first[1],
    ang: Math.atan2(second[1] - first[1], second[0] - first[0])
  };
  saved.chapter = track.chapter;
  saved.chapterId = track.chapterId;
  saved.chapterTitle = track.chapterTitle;
  fs.writeFileSync(file, JSON.stringify(saved, null, 2) + '\n');
}

fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({
  files: tracks.map((track) => track.id + '.json')
}, null, 2) + '\n');

process.stdout.write('Synced ' + tracks.length + ' chapter arena tracks.\n');
