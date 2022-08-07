import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import { detailedDiff } from "deep-object-diff";
import express from "express";
import { readFile, existsSync, readdir, lstat } from "fs";
import { resolve } from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import App from "../src/App";
import bodyParser from "body-parser";
import { createServer } from "http";
import * as io from "socket.io";
import Axios from "axios";

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);

const socketIo = io(httpServer);

app.use(express.static("./build"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let newFiles = [];
let diffFiles = [];
let totalScanFiles = 0;

const compareDiff = (spath, tpath) => {
  // Promise for source Data
  const sourceDataPromise = new Promise((resolvePro, rejectPro) => {
    readFile(spath, "utf-8", (err, dataS) => {
      if (err) {
        return rejectPro(new Error(err));
      }
      const sourceParser = new XMLParser({
        ignoreAttributes: false,
      });
      const lhs = sourceParser.parse(dataS);
      resolvePro({ lhs });
    });
  });

  // Promise for Target Data
  const targetDataPromise = new Promise((resolveTPro, rejectTPro) => {
    readFile(tpath, "utf-8", (err, dataT) => {
      if (err) {
        return rejectTPro(new Error(err));
      }
      const sourceParser = new XMLParser({
        ignoreAttributes: false,
      });
      const rhs = sourceParser.parse(dataT);
      resolveTPro({ rhs });
    });
  });

  // Resolve both Promises
  Promise.all([sourceDataPromise, targetDataPromise])
    .then((datas) => {
      const [data1, data2] = datas;
      const { lhs: lhs_1, rhs: rhsD } = data1;
      const { rhs: rhs_1, lhs: lhsD } = data2;
      const { added = {}, deleted = {}, updated = {} } = detailedDiff(
        lhs_1 || lhsD,
        rhs_1 || rhsD
      );
      if (
        Object.keys(added).length ||
        Object.keys(deleted).length ||
        Object.keys(updated).length
      ) {
        diffFiles.push({
          s: spath,
          t: tpath,
        });
      }
    })
    .catch((err) => {
      throw new Error(err);
    });
};

const checkFileDiff = (sPath, tPath) => {
  // check if file or folder exists
  socketIo.emit("compare_done", "progress");
  if (existsSync(sPath) && existsSync(tPath)) {
    readdir(sPath, (err, files) => {
      if (err) {
        throw new Error(err);
      }
      if (!files.length) {
        ++totalScanFiles;
      }
      files.forEach((file) => {
        const subSPath = `${sPath}/${file}`;
        const subTPath = `${tPath}/${file}`;
        if (!existsSync(subTPath)) {
          ++totalScanFiles;
          return newFiles.push({
            sPath: subSPath,
          });
        }
        return lstat(subSPath, (err2, stats) => {
          if (err2) {
            throw new Error(err2);
          }
          const isDir = stats.isDirectory();
          if (isDir) {
            return setTimeout(() => {
              checkFileDiff(resolve(subSPath), resolve(subTPath));
              ++totalScanFiles;
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              compareDiff(subSPath, subTPath);
              ++totalScanFiles;
              socketIo.emit("compare_done", "done");
            }, 2000);
          }
        });
      });
    });
  } else {
    socketIo.emit("compare_done", "done");
    readdir(sPath, (err, files) => {
      if (err) {
        throw new Error(err);
      }
      if (!files.length) {
        ++totalScanFiles;
      }
      files.forEach((file) => {
        const subSPath = `${sPath}/${file}`;
        const subTPath = `${tPath}/${file}`;
        if (!existsSync(subTPath)) {
          ++totalScanFiles;
          return newFiles.push({
            sPath: subSPath,
          });
        }
        return lstat(subSPath, (err2, stats) => {
          if (err2) {
            throw new Error(err2);
          }
          const isDir = stats.isDirectory();
          if (isDir) {
            socketIo.emit("compare_done", "progress");
            return setTimeout(() => {
              checkFileDiff(resolve(subSPath), resolve(subTPath));
              ++totalScanFiles;
              socketIo.emit("compare_done", "done");
            }, 2000);
          } else {
            socketIo.emit("compare_done", "done");
            ++totalScanFiles;
            return newFiles.push({
              sPath: subSPath,
            });
          }
        });
      });
    });
  }
};

app.get("/", (req, res) => {
  const app = ReactDOMServer.renderToString(<App />);
  const indexFile = path.resolve("./build/index.html");

  fs.readFile(indexFile, "utf8", (err, data) => {
    if (err) {
      console.error("Something went wrong:", err);
      return res.status(500).send("Oops, better luck next time!");
    }

    return res.send(
      data.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
    );
  });
});

app.post("/xml", (req, res, next) => {
  try {
    const { sourcePath, targetPath } = req.body;
    newFiles = [];
    diffFiles = [];
    totalScanFiles = 0;
    if (!sourcePath || !targetPath) {
      return res.status(400).send("Please provide paths");
    }

    const parentSPath = resolve(sourcePath);
    const parentTPath = resolve(targetPath);

    // first call
    socketIo.emit("compare_done", "progress");
    setTimeout(() => {
      checkFileDiff(parentSPath, parentTPath);
      socketIo.emit("compare_done", "done");
    }, 5000);

    return res.status(200).send("Started ....... !");
  } catch (error) {
    throw new Error(error);
  }
});

app.post("/fileData", async (req, res) => {
  const { source, target } = req.body;
  if (!source || !target) {
    return res.status(400).send("bad request");
  }
  const sourceData = new Promise((resolveP) => {
    readFile(resolve(source), "utf8", (err, data) => {
      if (err) {
        return res.status(500).send("Oops, better luck next time!");
      }
      return resolveP({ s: data });
    });
  });

  const targetData = new Promise((resolveP) => {
    readFile(resolve(target), "utf8", (err, data) => {
      if (err) {
        return res.status(500).send("Oops, better luck next time!");
      }
      return resolveP({ t: data });
    });
  });

  const responseData = await Promise.all([sourceData, targetData]);
  return res.send(responseData);
});

app.get("/stats", (req, res, next) => {
  res.send({
    newFiles,
    diffFiles,
    totalScanFiles: totalScanFiles - 1,
  });
});

app.get("/health", (req, res) => {
  res.send("system healthly.....");
});

httpServer.listen(port, () => {
  console.log(`listening on *:${port}`);
});

socketIo.on("connection", (socket) => {
  console.log("new client connected");
});

if (process.env.IS_PROD) {
  setInterval(function() {
    Axios.get("https://file-compare-react-merge.herokuapp.com/health");
  }, 300000);
}
