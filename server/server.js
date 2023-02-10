import { XMLParser, XMLBuilder } from "fast-xml-parser";
import XMLValidator from "w3c-xml-validator";
import express from "express";
import fileUpload from "express-fileupload";
import {
  readFile,
  existsSync,
  readdir,
  lstat,
  writeFileSync,
  readdirSync,
  statSync,
  unlink,
  readFileSync,
  mkdirSync,
  lstatSync,
  createReadStream,
  rmdirSync,
} from "fs";
import { resolve } from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import bodyParser from "body-parser";
import { createServer } from "http";
import * as io from "socket.io";
import uniqid from "uniqid";
import unzipper from "unzipper";

// Local imports
import App from "../src/App";
import transFormXMLFile from "./utils/formatXML";
import getDiffOverView from "./utils/overviewFile";
import { checkTotalFiles, startCompare } from "./utils/utils";
import {
  addUserSession,
  getSessionIdData,
  clearSessionId,
} from "./utils/localDB";

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);
const socketIo = io(httpServer);

app.use(fileUpload());
app.use(express.static("./build"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Golbal variable
const optionsP = {
  allowBooleanAttributes: true,
  format: true,
  suppressBooleanAttributes: false,
  preserveOrder: true,
};

// Api endpoints
app.get("/", (req, res) => {
  const app = ReactDOMServer.renderToString(<App />);
  const indexFile = resolve("./build/index.html");

  readFile(indexFile, "utf8", (err, data) => {
    if (err) {
      console.error("Something went wrong:", err);
      throw new Error("Something went wrong....!");
    }

    return res.send(
      data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
    );
  });
});

app.get("/stats", (req, res, next) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.send({});
  }
  const statsData = getSessionIdData(sessionId);
  const { newFiles, diffFiles, totalFiles, totalScan = [] } =
    statsData[sessionId] || {};
  res.send({
    newFiles,
    diffFiles,
    totalFiles,
    totalScanFiles: totalScan.length,
  });
});

app.get("/local/file", (req, res) => {
  const { path } = req.query;
  const data = readFileSync(path, "utf-8");
  return res.send(data);
});

app.get("/report/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  console.log(sessionId);
  const reportPath = `report_${sessionId}.html`;
  if (existsSync(resolve(__dirname, reportPath))) {
    readFile(resolve(__dirname, reportPath), "utf8", (err, data) => {
      if (err) {
        console.error("Something went wrong:", err);
        throw new Error("Something went wrong....!");
      }

      return res.status(200).send(data);
    });
  } else {
    res.status(404).send("No file");
  }
});

app.get("/single/xml", (req, res) => {
  const app = ReactDOMServer.renderToString(<App singleView={true} />);
  const indexFile = resolve("./build/index.html");

  readFile(indexFile, "utf8", (err, data) => {
    if (err) {
      console.error("Something went wrong:", err);
      throw new Error("Something went wrong....!");
    }

    return res.send(
      data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
    );
  });
});

app.post("/xml", async (req, res, next) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const { isFile, clientId } = req.query;
    let newFiles = [];
    let diffFiles = [];
    let totalScan = [];
    let totalFiles = 0;
    const filesPath = __dirname + "/files";
    const sessionId = uniqid();
    if (existsSync(filesPath)) {
      rmdirSync(filesPath, { recursive: true });
    }

    if (isFile === "true") {
      const fileS = req.files.sourceFile;
      const fileT = req.files.targetFile;
      const fileNameS = fileS.name;
      const fileNameT = fileT.name;
      const filesPath = __dirname + "/files";

      if (!existsSync(filesPath)) {
        mkdirSync(filesPath, { recursive: true });
      }

      await new Promise((re, rj) => {
        fileS.mv(`${filesPath}/${fileNameS}`, (err) => {
          if (err) {
            throw new Error(`Error:: ${fileNameS}`);
          }
          fileT.mv(`${filesPath}/${fileNameT}`, (err) => {
            if (err) {
              throw new Error(`Error:: ${fileNameT}`);
            }
            const files = [
              { type: "S", path: `${filesPath}/${fileNameS}` },
              { type: "T", path: `${filesPath}/${fileNameT}` },
            ];
            let sourcePath = "";
            let targetPath = "";
            files.forEach(({ type, path }) => {
              createReadStream(path)
                .pipe(unzipper.Extract({ path: `${filesPath}/${type}` }))
                .on("error", function(err) {
                  throw new Error(`Error Extract:: ${filesPath}`);
                })
                .on("close", function() {
                  console.log("Done.....");
                  if (type === "S") {
                    sourcePath = `${filesPath}/${type}`;
                  }
                  if (type === "T") {
                    targetPath = `${filesPath}/${type}`;
                  }
                  if (sourcePath && targetPath) {
                    console.log(sourcePath, targetPath);
                    totalFiles = checkTotalFiles(sourcePath);
                    addUserSession({
                      sessionId,
                      newFiles,
                      diffFiles,
                      totalFiles,
                      totalScan,
                    });
                    startCompare(
                      sourcePath,
                      targetPath,
                      totalScan,
                      newFiles,
                      diffFiles,
                      totalFiles,
                      sessionId,
                      socketIo,
                      clientId
                    );
                    console.log("totalFiles", totalFiles);
                    re("done");
                  }
                });
            });
          });
        });
      });
    } else {
      if (!sourcePath || !targetPath) {
        return res.status(400).send("Please provide paths");
      }
      totalFiles = checkTotalFiles(sourcePath);
      addUserSession({ sessionId, newFiles, diffFiles, totalFiles, totalScan });
      startCompare(
        sourcePath,
        targetPath,
        totalScan,
        newFiles,
        diffFiles,
        totalFiles,
        sessionId,
        socketIo,
        clientId
      );
    }
    return res.status(200).send({
      message: "Started ....... !",
      totalFiles: totalFiles,
      sessionId,
    });
  } catch (error) {
    throw new Error(error);
  }
});

app.post("/fileData", async (req, res) => {
  const { source, target } = req.body;
  if (!source || !target) {
    return res.status(400).send("bad request");
  }
  const sourceData = transFormXMLFile(source, "s");
  const targetData = transFormXMLFile(target, "t");
  const responseData = await Promise.all([sourceData, targetData]);
  // =====================
  const [s1, s2] = responseData;
  const sData = s1.s || s2.s;
  const tData = s2.t || s1.t;

  // console.log(JSON.stringify(responseData));

  // ===========================
  const targetParser = new XMLParser({
    ignoreAttributes: false,
    ...optionsP,
  });

  const soruceParser = new XMLParser({
    ignoreAttributes: false,
    ...optionsP,
  });
  // ====================================
  const targetDataD = (tData && targetParser.parse(tData)) || {};
  const sourceDataD = (sData && soruceParser.parse(sData)) || {};
  // const options = { ignoreCase: true, reverse: false, depth: 1, indentSize: 2 };
  const fSData = sourceDataD;
  const fTData = targetDataD;
  // =================================
  const builderTarget = new XMLBuilder({
    ignoreAttributes: false,
    ...optionsP,
  });
  const finalTarget = builderTarget.build(fTData);
  const builderSource = new XMLBuilder({
    ignoreAttributes: false,
    ...optionsP,
  });
  const finalSource = builderSource.build(fSData);

  // create temp file for target
  const taretTempFile = `${uniqid()}_target.xml`;
  writeFileSync(resolve(__dirname, taretTempFile), finalTarget, "utf8");
  const sourceTempFile = `${uniqid()}_source.xml`;
  writeFileSync(resolve(__dirname, sourceTempFile), finalSource, "utf8");

  const finalSourceData = transFormXMLFile(
    resolve(__dirname, sourceTempFile),
    "s"
  );
  const finslTargetData = transFormXMLFile(
    resolve(__dirname, taretTempFile),
    "t"
  );
  const finslresponseData = await Promise.all([
    finalSourceData,
    finslTargetData,
  ]);
  let sourceD = "";
  let targetD = "";
  if (finslresponseData.length) {
    // =====================
    const [s1D, s2D] = responseData;
    sourceD = s1D.s || s2D.s;
    targetD = s2D.t || s1D.t;
    [
      resolve(__dirname, taretTempFile),
      resolve(__dirname, sourceTempFile),
    ].forEach((unlinkPath, index) => {
      unlink(unlinkPath, (err, data) => {
        if (err) {
          console.log("Error: unlink" + index, err);
        }
      });
    });
  }
  return res.send([{ s: sourceD || "", t: targetD || "" }]);
});

app.post("/saveFile", (req, res) => {
  try {
    const { target, source } = req.body;
    if (!target) {
      return res.status(400).send({ message: "path is not correct" });
    }
    // Saving File
    const stats = lstatSync(source);
    const isDir = stats.isDirectory();
    if (isDir) {
      mkdirSync(target);
    } else {
      const data = readFileSync(resolve(source), { encoding: "utf-8" });
      writeFileSync(target, data, { encoding: "utf-8" });
    }
    return res.status(200).send({ message: "Saved Successfully" });
  } catch (error) {
    return res.status(500).send({ message: "Somthing went wrong" });
  }
});

app.post("/diff/overview", async (req, res) => {
  const { sourcePath, targetPath } = req.body;
  const result = await getDiffOverView(sourcePath, targetPath);
  return res.send(result);
});

app.post("/update/file", (req, res) => {
  const { fileData, filePath } = req.body;
  writeFileSync(resolve(__dirname, filePath), fileData, "utf-8");
  return res.send({ message: "file updated successfully.", filePath });
});

app.post("/sort/validate", async (req, res) => {
  const { fileData } = req.body;
  if (!fileData) {
    return res
      .status(400)
      .send({ message: "please provide data", result: null });
  }
  const sourceTempFile = `${uniqid()}_source.xml`;
  writeFileSync(resolve(__dirname, sourceTempFile), fileData, "utf-8");
  const sourceData = transFormXMLFile(sourceTempFile, "s");
  const responseData = await Promise.all([sourceData]);
  // =====================
  const [s1] = responseData;
  const sData = s1.s;

  const soruceParser = new XMLParser({
    ignoreAttributes: false,
    ...optionsP,
  });
  // ====================================
  const sourceDataD = soruceParser.parse(sData);
  const fSData = sourceDataD;
  // =================================
  const builderSource = new XMLBuilder({
    ignoreAttributes: false,
    ...optionsP,
  });
  const finalSource = builderSource.build(fSData);

  // create temp file for target
  writeFileSync(resolve(__dirname, sourceTempFile), finalSource, "utf8");

  const finalSourceData = transFormXMLFile(
    resolve(__dirname, sourceTempFile),
    "s"
  );
  const finslresponseData = await Promise.all([finalSourceData]);
  let sourceD = "";
  if (finslresponseData.length) {
    // =====================
    const [s1D] = responseData;
    sourceD = s1D.s;
    [resolve(__dirname, sourceTempFile)].forEach((unlinkPath, index) => {
      unlink(unlinkPath, (err, data) => {
        if (err) {
          console.log("Error: unlink" + index, err);
        }
      });
    });
  }
  const result = await XMLValidator(sourceD);
  console.log("result", result);
  if (!result) {
    return res.status(400).send({ message: "xml not valid", result });
  }
  return res.send({ message: "xml valid", result: sourceD });
});

// ====================================================>

app.get("/health", (req, res) => {
  res.send("system healthly.....");
});

httpServer.listen(port, () => {
  console.log(`listening on *:${port}`);
});
const clients = [];
socketIo.on("connection", (socket) => {
  socket.on("storeClientInfo", function(data) {
    const clientInfo = new Object();
    clientInfo.uid = (data && data.uid) || "";
    clientInfo.clientId = socket.id;
    clients.push(clientInfo);
    socket.emit("getClient", { clientInfo });
    console.log("new client connected", clients);
  });

  socket.on("disconnect", function(data) {
    const indexClient = clients.findIndex(
      (dataItem) => dataItem.clientId === socket.id
    );
    if (indexClient !== -1) {
      clients.splice(indexClient, 1);
    }
  });
});
