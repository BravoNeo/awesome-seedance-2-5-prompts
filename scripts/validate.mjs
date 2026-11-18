import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(
  await readFile(new URL('../export/catalog.json', import.meta.url), 'utf8')
);
const categories = new Set([
  'action', 'character-animation', 'comedy', 'landscape', 'product',
  'storytelling', 'travel-commercial', 'ugc', 'video-editing',
]);
const languages = new Set(['EN', 'JA', 'ZH']);
const slugs = new Set();
const prompts = new Set();
const videoPosts = new Set();
const promptPosts = new Set();
const mediaIds = new Set();

function insert(set, value, label) {
  assert.ok(!set.has(value), 'Duplicate ' + label + ' ' + value);
  set.add(value);
}

function statusId(value, handle) {
  const url = new URL(value);
  assert.equal(url.origin, 'https://x.com');
  assert.equal(url.search + url.hash, '');
  const match = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{15,24})$/.exec(url.pathname);
  assert.ok(match, 'Invalid X status URL ' + value);
  assert.equal(handle.toLowerCase(), match[1].toLowerCase());
  return match[2];
}

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.model, 'Seedance 2.5');
assert.equal(catalog.source.platform, 'X');
assert.equal(catalog.source.provider, 'AIsa ONE');
assert.match(catalog.source.observedOn, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(catalog.entries.length > 0);
assert.equal(catalog.count, catalog.entries.length);

for (const entry of catalog.entries) {
  const { slug, author, video, prompt, stats } = entry;
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(!['explore', 'categories'].includes(slug));
  insert(slugs, slug, 'slug');
  assert.ok(categories.has(entry.category), slug);
  assert.ok(languages.has(entry.promptLanguage), slug);
  assert.equal(typeof entry.startingImage, 'boolean');
  assert.equal(entry.promptKind, 'adapted');
  assert.ok(entry.tags.length >= 2);
  for (const locale of ['en', 'ja']) {
    assert.ok(entry.title[locale].trim());
    assert.ok(entry.summary[locale].trim());
  }
  assert.match(author.handle, /^[A-Za-z0-9_]{1,15}$/);
  assert.ok(author.name);
  assert.ok(Number.isFinite(Date.parse(entry.publishedAt)));
  assert.equal(entry.modelAttribution.model, catalog.model);
  assert.equal(entry.modelAttribution.basis, 'author-statement');

  const promptPost = statusId(entry.promptSourceUrl, author.handle);
  const videoPost = statusId(entry.videoSourceUrl, author.handle);
  insert(videoPosts, videoPost, 'video post');
  insert(promptPosts, promptPost, 'prompt post');
  assert.equal(entry.pairing, promptPost === videoPost ? 'same-post' : 'same-author-thread');

  assert.ok(prompt.length >= 130 && prompt === prompt.trim());
  assert.doesNotMatch(prompt, /https?:\/\/|\p{Cc}|#[a-z]|@[a-z]|[<>]/iu);
  insert(prompts, prompt.normalize('NFKC').toLowerCase().replace(/[\p{P}\s]+/gu, ''), 'prompt');

  assert.match(video.sourceMediaId, /^\d{15,24}$/);
  insert(mediaIds, video.sourceMediaId, 'media ID');
  assert.ok(Number.isInteger(video.width) && video.width > 0);
  assert.ok(Number.isInteger(video.height) && video.height > 0);
  assert.ok(Number.isFinite(video.durationSec) && video.durationSec > 0);
  assert.equal(video.orientation, video.width === video.height
    ? 'square'
    : video.width > video.height ? 'landscape' : 'portrait');
  assert.equal(Object.keys(video).sort().join(','),
    'durationSec,height,orientation,sourceMediaId,width');
  for (const key of ['views', 'likes', 'comments', 'reposts']) {
    assert.ok(stats[key] === null || (Number.isInteger(stats[key]) && stats[key] >= 0));
  }
}

console.log('Validated ' + catalog.count + ' Seedance 2.5 prompts and their X sources.');
