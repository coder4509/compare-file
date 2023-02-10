import { generateFullReport } from "./utils";

let localDb = [];
export const addUserSession = (data) => {
  const { sessionId, newFiles, diffFiles, totalFiles, totalScan } = data || {};
  const sessionObj = {
    [sessionId]: {
      newFiles,
      diffFiles,
      totalFiles,
      totalScan,
      sessionId,
    },
  };
  const isSessionIdPresent = localDb.find(
    (sessionData) =>
      sessionData && sessionData[sessionId] && sessionData[sessionId].sessionId
  );
  if (isSessionIdPresent) {
    localDb = localDb.filter(
      (sessionD) => sessionD[sessionId].sessionId !== sessionId
    );
  } else {
    localDb.push(sessionObj);
  }
};

export const updateSessionData = (data) => {
  const { sessionId, newFiles, diffFiles, totalFiles, totalScan } = data || {};
  // generate report
  if (totalScan.length === totalFiles) {
    generateFullReport(data);
  }
  // end
  localDb = localDb.map((sessionD) => {
    if (sessionD[sessionId]) {
      sessionD[sessionId].newFiles = newFiles;
      sessionD[sessionId].diffFiles = diffFiles;
      sessionD[sessionId].totalFiles = totalFiles;
      sessionD[sessionId].totalScan = totalScan;
    }
    return sessionD;
  });
};

export const getSessionIdData = (id) => {
  return (
    localDb.filter((data) => {
      return data[id] && data[id].sessionId === id;
    })[0] || {}
  );
};

export const clearSessionId = () => {
  localDb = [];
};

export default localDb;
