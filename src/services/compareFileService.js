import axios from "axios";

const startFileCompare = async (spath, tpath) => {
  const URL = window && window.window.location.origin;
  if (!URL) {
    return false;
  }
  return await axios.post(`${URL}/xml`, {
    sourcePath: spath,
    targetPath: tpath,
  });
};

const getStats = async () => {
  const URL = window && window.window.location.origin;
  if (!URL) {
    return false;
  }
  return await axios.get(`${URL}/stats`);
};

const getFileData = async (spath, tpath) => {
  const URL = window && window.window.location.origin;
  if (!URL) {
    return false;
  }
  return await axios.post(`${URL}/fileData`, {
    source: spath,
    target: tpath
  });
};

const saveFile = async (spath, tpath) => {
  const URL = window && window.window.location.origin;
  if (!URL) {
    return false;
  }
  return await axios.post(`${URL}/saveFile`, {
    source: spath,
    target: tpath
  });
}

export { startFileCompare, getStats , getFileData, saveFile};
