/// <reference path="../pb_data/types.d.ts" />

// A folder id from the request must exist and belong to the caller.
function requireOwnedFolder(e, id) {
  let folder = null;
  try { folder = e.app.findRecordById("folders", id); } catch (_) { /* reported below */ }
  if (!folder || folder.getString("owner") !== e.auth.id) {
    throw new BadRequestError("Folder not found.");
  }
  return folder;
}

// Parent must be the caller's folder, and a folder can't end up inside itself.
function checkFolder(e) {
  if (e.hasSuperuserAuth()) return;
  const parentId = e.record.getString("parent");
  if (!parentId) return;
  requireOwnedFolder(e, parentId);
  if (e.record.isNew()) return;
  let cur = parentId;
  for (let depth = 0; cur && depth < 200; depth++) {
    if (cur === e.record.id) throw new BadRequestError("A folder can't be moved into itself.");
    cur = e.app.findRecordById("folders", cur).getString("parent");
  }
}

// Folder must be the caller's. Content saves must send revision = stored + 1, so a save
// based on an older copy (another device saved in between) is rejected with 409.
function checkDrawing(e) {
  if (e.hasSuperuserAuth()) return;
  const folderId = e.record.getString("folder");
  if (folderId) requireOwnedFolder(e, folderId);
  if (e.record.isNew()) {
    e.record.set("revision", 0);
    return;
  }
  const prev = e.record.original();
  const prevRev = prev.getInt("revision");
  const dataChanged = e.record.getString("data") !== prev.getString("data");
  const rev = e.record.getInt("revision");
  if ((dataChanged || rev !== prevRev) && rev !== prevRev + 1) {
    throw new ApiError(409, "This drawing was changed on another device.", { revision: prevRev });
  }
}

module.exports = { checkFolder, checkDrawing };
