/// <reference path="../pb_data/types.d.ts" />
// Inkboard schema: users (no self sign-up), folders, drawings, assets, plus server settings.
// Every record has an owner; API rules and pb_hooks/inkboard.pb.js keep users to their own data.

migrate((app) => {
  // ---- users: accounts are created by an admin only; log in with username or email
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;   // superusers only (admin UI / API)
  users.deleteRule = null;
  users.fields.add(new TextField({
    name: "username",
    required: true,
    min: 3,
    max: 32,
    pattern: "^[a-z0-9][a-z0-9_.-]*$",
    presentable: true,
  }));
  users.addIndex("idx_users_username", true, "username", "");
  users.fields.getByName("email").required = false; // accounts created by the admin may not have one
  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ["username", "email"];
  users.authToken.duration = 30 * 24 * 60 * 60; // 30 days, renewed whenever the app opens
  users.authAlert.enabled = false;              // needs SMTP, which a home server usually lacks
  users.oauth2.enabled = false;
  users.otp.enabled = false;
  users.mfa.enabled = false;
  app.save(users);

  // Plain field objects: the Collection constructor unmarshals JSON-like data.
  const owner = () => ({
    type: "relation", name: "owner", required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id,
  });
  const timestamps = () => [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];
  const mine = "owner = @request.auth.id";
  const createMine = "@request.auth.id != '' && owner = @request.auth.id";
  const keepOwner = "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)";

  // ---- folders (nestable; deleting a folder deletes its subfolders and drawings)
  const folders = new Collection({
    type: "base",
    name: "folders",
    listRule: mine, viewRule: mine, createRule: createMine, updateRule: keepOwner, deleteRule: mine,
    fields: [
      { type: "text", name: "name", required: true, max: 120 },
      owner(),
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_folders_owner ON folders (owner)"],
  });
  app.save(folders);
  folders.fields.add(new RelationField({
    name: "parent", maxSelect: 1, cascadeDelete: true, collectionId: folders.id,
  }));
  app.save(folders);

  // ---- drawings: the document JSON is a protected file so large drawings don't bloat the DB
  const drawings = new Collection({
    type: "base",
    name: "drawings",
    listRule: mine, viewRule: mine, createRule: createMine, updateRule: keepOwner, deleteRule: mine,
    fields: [
      { type: "text", name: "title", required: true, max: 200 },
      owner(),
      { type: "relation", name: "folder", maxSelect: 1, cascadeDelete: true, collectionId: folders.id },
      {
        type: "file", name: "data", maxSelect: 1, maxSize: 50 * 1024 * 1024, protected: true,
        mimeTypes: ["application/json"],
      },
      {
        type: "file", name: "thumbnail", maxSelect: 1, maxSize: 2 * 1024 * 1024, protected: true,
        mimeTypes: ["image/png", "image/jpeg", "image/webp"],
      },
      { type: "number", name: "revision", onlyInt: true, min: 0 },
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_drawings_owner_folder ON drawings (owner, folder)"],
  });
  app.save(drawings);

  // ---- assets: images (incl. rendered PDF pages) referenced by drawings as "<id>/<file>"
  const assets = new Collection({
    type: "base",
    name: "assets",
    listRule: mine, viewRule: mine, createRule: createMine, updateRule: null, deleteRule: mine,
    fields: [
      owner(),
      {
        type: "file", name: "file", required: true, maxSelect: 1, maxSize: 30 * 1024 * 1024, protected: true,
        mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      },
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_assets_owner ON assets (owner)"],
  });
  app.save(assets);

  // ---- settings
  const settings = app.settings();
  settings.meta.appName = "Inkboard";
  settings.rateLimits.enabled = true;            // defaults include 2 auth attempts / 3 s per IP
  settings.trustedProxy.headers = ["X-Real-IP"]; // set by nginx/default.conf from the real client IP
  app.save(settings);
}, (app) => {
  for (const name of ["assets", "drawings", "folders"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("username");
  users.removeIndex("idx_users_username");
  users.passwordAuth.identityFields = ["email"];
  users.fields.getByName("email").required = true;
  users.createRule = "";
  users.deleteRule = "id = @request.auth.id";
  app.save(users);
});
