import axios from "axios";

const startFileCompare = async ({
  spath,
  tpath,
  isFile,
  formFileData,
  clientId,
}) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  let postData = {
    sourcePath: spath,
    targetPath: tpath,
  };
  if (isFile) {
    postData = formFileData;
  }
  return await axios.post(
    `${API_URL}/xml?isFile=${isFile}&clientId=${clientId}`,
    postData
  );
};

const getStats = async (sessionId) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.get(`${API_URL}/stats?sessionId=${sessionId}`);
};

const getFileData = async (spath, tpath) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.post(`${API_URL}/fileData`, {
    source: spath,
    target: tpath,
  });
};

const saveFile = async (spath, tpath) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.post(`${API_URL}/saveFile`, {
    source: spath,
    target: tpath,
  });
};

const updateFile = async (fileData, filePath) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.post(`${API_URL}/update/file`, {
    fileData,
    filePath,
  });
};

const fileUpload = async (formData) => {
  const API_URL = window && window.window.location.origin;
  return await axios.post(`${API_URL}/xmlFile`, formData);
};

const sortValidate = async (fileData) => {
  const API_URL = window && window.window.location.origin;
  return await axios.post(`${API_URL}/sort/validate`, { fileData });
};

export {
  startFileCompare,
  getStats,
  getFileData,
  saveFile,
  fileUpload,
  updateFile,
  sortValidate,
};
