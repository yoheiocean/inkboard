/// <reference path="../pb_data/types.d.ts" />
// Server-side checks the API rules can't express cleanly. Each handler runs in its own
// JS context, so shared code is loaded with require() inside the handler.

onRecordCreateRequest((e) => {
  require(`${__hooks}/inkboard_lib.js`).checkFolder(e);
  e.next();
}, "folders");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/inkboard_lib.js`).checkFolder(e);
  e.next();
}, "folders");

onRecordCreateRequest((e) => {
  require(`${__hooks}/inkboard_lib.js`).checkDrawing(e);
  e.next();
}, "drawings");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/inkboard_lib.js`).checkDrawing(e);
  e.next();
}, "drawings");
