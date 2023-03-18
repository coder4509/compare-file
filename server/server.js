import { XMLParser, XMLBuilder } from "fast-xml-parser";
import XMLValidator from "w3c-xml-validator";
import express from "express";
import fileUpload from "express-fileupload";
import {
  readFile,
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  lstatSync,
  createReadStream,
  rmSync,
  readdirSync,
} from "fs";
import { resolve } from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import bodyParser from "body-parser";
import { createServer } from "http";
import * as io from "socket.io";
import uniqid from "uniqid";
import unzipper from "unzipper";
import moment from "moment";
import { rimraf } from "rimraf";
import cron from "node-cron";
import { exec } from "child_process";
import os from "os";

// Local imports
import App from "../src/App";
import transFormXMLFile from "./utils/formatXML";
import getDiffOverView from "./utils/overviewFile";
import {
  checkTotalFiles,
  startCompare,
  getJenkinsFilePaths,
} from "./utils/utils";
import {
  addUserSession,
  getSessionIdData,
  clearSessionId,
} from "./utils/localDB";

import {
  createWorkflow,
  createNewSwarm,
  deleteWorkSpace,
  p4login,
  reverCheckList,
  getPendingList,
} from "./utils/perforce/perforce_node";
import { branchConfig } from "./config/config";
import initDB from "./config/localEnvDb/db";

const localCollection = initDB();

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);
const socketIo = io(httpServer);

app.use(fileUpload());
app.use(express.static("./build"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set("views", resolve(__dirname, "views"));
app.set("view engine", "ejs");

// Global variable
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
  const reportPath = `${resolve(
    __dirname,
    "reports/",
    moment().format("DD-MM-YYYY")
  )}/report_${sessionId}.html`;
  console.log(reportPath);
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

// for jenkins
app.post("/jenkins_xml", async (req, res) => {
  try {
    const { isJenKins, isSS, isRT } = req.query;
    let newFiles = [];
    let diffFiles = [];
    let totalScan = [];
    let totalFiles = 0;
    let jenkinsSPath = "";
    let jenkinsTPath = "";
    const updateData = localCollection.find("branch");
    const { data: { data: { selectedBranch } = {} } = {} } = updateData || {};
    const sessionId = uniqid();
    const jenKinsProSync = resolve(
      __dirname,
      `jenkins_${moment().format("DD-MM-YYYY")}`
    );
    if (!existsSync(jenKinsProSync)) {
      mkdirSync(jenKinsProSync);
    }
    if (
      (isJenKins === "true" || isJenKins === true) &&
      (isSS === "true" || isSS === true)
    ) {
      const paths = await getJenkinsFilePaths({
        sourceURL: process.env.LATEST_PROD_SS_CONTENT_VERSION,
        targetURL: process.env.LATEST_DEV_SS_CONTENT_VESRION,
        sfileUrl: process.env.PROD_SS_FILE_NAME,
        tfileUrl: process.env.DEV_SS_FILE_NAME,
        syncPath: `jenkins_${moment().format("DD-MM-YYYY")}`,
        syncFor: "SS",
        sessionId,
        selectedBranch: selectedBranch || process.env.LOCAL_SYNC_BRANCH
      });
      jenkinsSPath = (paths && paths.s.spath) || "";
      jenkinsTPath = (paths && paths.t.tpath) || "";
    } else if (
      (isJenKins === "true" || isJenKins === true) &&
      (isRT === "true" || isRT === true)
    ) {
      const paths = await getJenkinsFilePaths({
        sourceURL: process.env.LATEST_PROD_RT_CONTENT_VERSION,
        targetURL: process.env.LATEST_DEV_RT_CONTENT_VESRION,
        sfileUrl: process.env.PROD_RT_FILE_NAME,
        tfileUrl: process.env.DEV_RT_FILE_NAME,
        syncPath: `jenkins_${moment().format("DD-MM-YYYY")}`,
        syncFor: "RT",
        sessionId,
        selectedBranch: selectedBranch || process.env.LOCAL_SYNC_BRANCH
      });
      jenkinsSPath = (paths && paths.s.spath) || "";
      jenkinsTPath = (paths && paths.t.tpath) || "";
    }
    console.log("final paths", jenkinsSPath, jenkinsTPath);
    if (!jenkinsSPath || !jenkinsTPath) {
      return res.status(400).send("Please provide paths");
    }
    totalFiles = checkTotalFiles(jenkinsSPath);
    addUserSession({ sessionId, newFiles, diffFiles, totalFiles, totalScan });
    startCompare(
      jenkinsSPath,
      jenkinsTPath,
      totalScan,
      newFiles,
      diffFiles,
      totalFiles,
      sessionId,
      socketIo,
      undefined
    );
    // start corn job for every call start and stop
    const cronExpression = process.env.CRON_TIMER;
    const cornJob = cron.schedule(
      cronExpression,
      () => {
        const reportPath = resolve(
          __dirname,
          "reports",
          moment().format("DD-MM-YYYY"),
          `report_${sessionId}.html`
        );
        const headerReportPath = resolve(__dirname, `${sessionId}_.html`);
        const tempSessionPath = resolve(__dirname, `temp_${sessionId}`);
        if (
          existsSync(reportPath) &&
          existsSync(headerReportPath) &&
          existsSync(tempSessionPath)
        ) {
          const tempFolderFiles = readdirSync(tempSessionPath);
          console.log("tempFolderFiles", tempFolderFiles, sessionId);
          if (tempFolderFiles.length === 0) {
            rimraf(resolve(__dirname, `temp_${sessionId}`)).catch((err) => {
              console.log("Errr: unlink temp file", err);
            });
            exec(
              `(
                echo "To: ${process.env.MAIL_TO}"
                echo "Cc: ${process.env.MAIL_CC}"
                echo "Subject: ${
                  isSS === "true" || isSS === true ? "Self-Service" : ""
                }${
                isRT === "true" || isRT === true ? "Retail/TLS" : ""
              } - Producation Content Sync"
                echo "Content-Type: text/html"
                echo 
                cat ${headerReportPath}
                echo
                cat ${reportPath}
            ) | sendmail -t`,
              (error, stdout, stderr) => {
                if (error) {
                  console.log(`error: ${error.message}`, "::::::", sessionId);
                  return;
                }
                if (stderr) {
                  console.log(`stderr: ${stderr}`, "::::::", sessionId);
                  return;
                }
                console.log(`stdout: ${stdout}`, "::::::", sessionId);
              }
            );
            cornJob.stop();
          }
        }
      },
      { scheduled: false }
    );
    cornJob.start();
    return res.status(200).send({
      message: "Jenkins:::::Started ....... !",
      totalFiles: totalFiles,
      sessionId,
    });
  } catch (error) {
    console.log("Error:: Jenkins ====>", error);
    throw new Error(error);
  }
});

app.post("/xml", async (req, res, next) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const { isFile, clientId, oldSessionId } = req.query;
    let newFiles = [];
    let diffFiles = [];
    let totalScan = [];
    let totalFiles = 0;
    const sessionId = uniqid();
    if (oldSessionId) {
      const filesPath = __dirname + `/files_session_${oldSessionId}`;
      if (existsSync(filesPath)) {
        rmSync(filesPath, { recursive: true });
      }
    }

    if (isFile === "true" || isFile === true) {
      const fileS = req.files.sourceFile;
      const fileT = req.files.targetFile;
      const fileNameS = fileS.name;
      const fileNameT = fileT.name;
      const filesPath = __dirname + `/files_session_${sessionId}`;

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
      rimraf(unlinkPath).catch((err) => {
        console.log("Error: unlink" + index, err);
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
    return res.status(500).send({ message: "Something went wrong" });
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
      rimraf(unlinkPath).catch((err) => {
        console.log("Error: unlink" + index, err);
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

app.post("/p4/createWorkspace", (req, res) => {
  const resData = createWorkflow();
  return res.send(resData);
});

app.post("/p4/login", (req, res) => {
  const resData = p4login();
  return res.send(resData);
});

app.post("/p4/swarm", (req, res) => {
  const resData = createNewSwarm();
  return res.send(resData);
});

app.delete("/p4/workspace", (req, res) => {
  const resData = deleteWorkSpace();
  return res.send(resData);
});

app.delete("/p4/revert", (req, res) => {
  const { cl } = req.body;
  const resD = reverCheckList(cl);
  return res.send(resD);
});

app.get("/p4/pending", (req, res) => {
  const re = getPendingList();
  res.send(re);
});

app.get("/update/env", (req, res) => {
  const branches = branchConfig.branch;
  const selected = branchConfig.selectedBranch;
  const updateData = localCollection.find("branch");
  const { data: { data: { selectedBranch } = {}, lastUpdatedBy = []} = {} } = updateData || {};
  const sortedDesc = lastUpdatedBy.sort((a, b) => moment(b.updateDate) - moment(a.updateDate));
  res.render("envUpdate", {
    branches: branches.split(","),
    selected: selectedBranch || selected,
    lastUpdatedBy: sortedDesc
  });
});

app.post("/update/env", (req, res) => {
  const { branch, username } = req.body;
  const isProd = process.env.IS_PROD;
  const isJenkins = process.env.IS_JENKINS;
  if ((isProd === true && isProd === 'true') && isJenkins) {
    const colFind = localCollection.find("branch");
    if (typeof colFind.exists === "boolean" && !colFind.exists) {
      localCollection.create("branch");
      localCollection.insert("branch", { selectedBranch: branch, username });
    } else {
      localCollection.insert("branch", { selectedBranch: branch, username });
    }
    return res.send({ message: "Updated Successfully" });
  }
  return res.send({ message: "This action only perform on production" });
});


app.get("/workspace/manage", (req, res) => {
  res.render("workspaceManage", {});
});

// ====================================================>

app.get("/health", (req, res) => {
  res.send("system healthly.....");
});

httpServer.listen(port, () => {
  console.log(`listening on *:${port}`);
  const hostname = os.hostname();
  const isJenkin = process.env.IS_JENKINS;
  const timerC = process.env.DAILY_CRON_TIMER;
  // const startCron = cron.schedule(
  //   timerC,
  //   function() {
  //     console.log("Daily 5am cron started for Prod sync");
  //     axios.post(`http://${hostname}:${port}/jenkins_xml?isJenKins=true&isSS=true`)
  //       .then(() => {
  //         console.log("SS=======***********=======");
  //         setTimeout(() => {
  //           console.log("RT=======***********=======");
  //           axios.post(
  //             `http://${hostname}:${port}/jenkins_xml?isJenKins=true&isRT=true`
  //           ).catch((err) => {
  //             console.log("Fetch cron Failed RT", err);
  //           });
  //         }, 60000 * 10);
  //       })
  //       .catch((err) => {
  //         console.log("Fetch cron Failed SS", err);
  //       });
  //   },
  //   {
  //     scheduled: false,
  //   }
  // );
  // if (isJenkin === "true" || isJenkin === true) {
  //   startCron.start();
  // }
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
