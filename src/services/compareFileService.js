import axios from "axios";

const startFileCompare = async ({spath, tpath, isFile, formFileData}) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  let postData = {
    sourcePath: spath,
    targetPath: tpath,
  }
  if(isFile) {
    console.log(formFileData);
    postData = formFileData;
  }
  return await axios.post(`${API_URL}/xml?isFile=${isFile}`, postData);
};

const getStats = async () => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.get(`${API_URL}/stats`);
};

const getFileData = async (spath, tpath) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.post(`${API_URL}/fileData`, {
    source: spath,
    target: tpath
  });
};

const saveFile = async (spath, tpath) => {
  const API_URL = window && window.window.location.origin;
  if (!API_URL) {
    return false;
  }
  return await axios.post(`${API_URL}/saveFile`, {
    source: spath,
    target: tpath
  });
}

const fileUpload = async (formData) => {
  const API_URL = window && window.window.location.origin;
    return await axios.post(`${API_URL}/xmlFile`, formData);
}

export { startFileCompare, getStats , getFileData, saveFile, fileUpload};
