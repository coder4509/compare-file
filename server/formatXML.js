import { readFile, writeFileSync, createReadStream, unlink } from "fs";
import { createInterface } from "readline";
import { resolve } from "path";
import { Readable } from "stream";
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import uniqid from "uniqid";
import json from "json-keys-sort";

const optionsP = {
  allowBooleanAttributes: true,
  suppressBooleanAttributes: false,
  ignoreAttributes: false,
};

const sortJsonChild = (mainData, jsonData, key, holdPosition) => {
  if (jsonData && typeof jsonData === "object") {
    jsonData.position = holdPosition;
    mainData[key] = json.sort(jsonData, true);
    Object.keys(jsonData).forEach((keyC, indexC) => {
      if (jsonData && typeof jsonData[keyC] === "object") {
        const childKeepPosition = indexC;
        sortJsonChild(mainData[key], jsonData[keyC], keyC, childKeepPosition);
      }
    });
  }
};

const createXmlToJson = (xmlData) => {
  const parser = new XMLParser(optionsP);
  let jObj = parser.parse(xmlData);
  Object.keys(jObj).forEach((key, index) => {
    const isChildObj = jObj[key];
    const keepPosition = index;
    sortJsonChild(jObj, isChildObj, key, keepPosition);
  });

  // sort and delete position
  const sorted = {};
  Object.keys(jObj)
    .sort(function(a, b) {
      return jObj[a].position - jObj[b].position;
    })
    .forEach(function(key) {
      const newObj = { ...jObj[key] };
      const deleteField = (obj, field) => {
        Object.keys(obj).forEach((key) => {
          if (key === field) {
            delete obj[key];
          } else if (typeof obj[key] === "object") {
            deleteField(obj[key], field);
          }
        });
      };
      deleteField(newObj, "position");
      sorted[key] = newObj;
    });
  return sorted;
};

const addInetends = (mainJson, keyName, data, intendSize) => {
  if (typeof data === "object") {
    Object.keys(data).map((key) => {
      const childData = data[key];
      if (childData && typeof childData === "object") {
        let intendChildSize = intendSize + (key.length - (key.length - 2));
        data[`${key}(indend_${intendSize})`] = childData;
        delete data[key];
        addInetends(
          data,
          `${key}(indend_${intendSize})`,
          childData,
          intendChildSize
        );
      } else {
        if (!data[key]) {
          data[`${key}(indend_${intendSize})`] = data[key];
          mainJson[keyName][`${key}(indend_${intendSize})`] = data[key];
          delete data[key];
        } else {
          mainJson[keyName][
            key
          ] = `${mainJson[keyName][key]}(indend_${intendSize})`;
        }
      }
    });
  } else {
    if (!mainJson[keyName]) {
      mainJson[`${keyName}(intend)_${intendSize})`] = data;
      delete mainJson[keyName];
    }
    mainJson[keyName] = `${mainJson[keyName]}(indend_${intendSize})`;
  }
};

const tranformJsonData = (xmlJsonObject = {}) => {
  const cloneXmlJsonObject = JSON.parse(JSON.stringify(xmlJsonObject));
  Object.keys(cloneXmlJsonObject).map((keyName) => {
    let intendParent = keyName.length - (keyName.length - 2);
    const keysData = cloneXmlJsonObject[keyName];
    addInetends(cloneXmlJsonObject, keyName, keysData, intendParent);
  });
  return cloneXmlJsonObject;
};

const transFormXMLFile = (filepath, type) => {
  return new Promise((ress, rejj) => {
    readFile(resolve(__dirname, filepath), "utf-8", (err, data) => {
      if (err) {
        rejj(err);
        throw new Error("Error");
      }
      const xmlData = createXmlToJson(data);
      const newData = tranformJsonData(xmlData);
      const builder = new XMLBuilder({
        ...optionsP,
      });
      const xmlDataStr = builder.build(newData);
      const newTempFile = `${uniqid()}.xml`;
      writeFileSync(resolve(__dirname, newTempFile), xmlDataStr, "utf8");
      ress(formatXMLFile(newTempFile, type));
    });
  });
};

const putNewLine = async (filePathOrData, isRaw = false) => {
  let fileStream = null;
  if (isRaw) {
    fileStream = Readable.from(filePathOrData, { encoding: "utf8" });
  } else {
    fileStream = createReadStream(resolve(__dirname, filePathOrData));
  }
  let xml = "";
  if (fileStream) {
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      let equalStart = false;
      const dataList = line.split("");
      let holeText = "";
      dataList.forEach((word, index) => {
        if (
          word === "=" &&
          (dataList[index + 1] === '"' || dataList[index + 1] === "'")
        ) {
          equalStart = true;
        } else if (
          word === '"' &&
          equalStart &&
          (dataList[index + 1] === " " ||
            dataList[index + 1] === "?" ||
            dataList[index + 1] === ">")
        ) {
          equalStart = false;
        }
        if ((word === ">" || word === " ") && !equalStart) {
          word = `${word}\n`;
        }
        return (holeText += word);
      });

      xml += holeText;
    }
  }
  return xml;
};

const formatXMLFile = async (filePath, type) => {
  const firstF = await putNewLine(filePath);
  /** indentation */
  const readable = Readable.from(firstF, { encoding: "utf8" });
  const rl2 = createInterface({
    input: readable,
    crlfDelay: Infinity,
  });
  let finalXml = "";
  for await (const line2 of rl2) {
    const dataList = line2.split("");
    let holeText = "";
    let isIntendStart = false;
    dataList.forEach((word, index) => {
      if (word === null) {
        return;
      }
      if (isIntendStart && word === ")") {
        isIntendStart = false;
        return;
      }

      if (
        word === "(" &&
        dataList[index + 1] === "i" &&
        dataList[index + 2] === "n" &&
        dataList[index + 3] === "d" &&
        dataList[index + 4] === "e" &&
        dataList[index + 5] === "n" &&
        dataList[index + 6] === "d" &&
        dataList[index + 7] === "_" &&
        typeof Number(dataList[index + 8]) === "number"
      ) {
        const extractTextIndex = line2.search("indend_");
        const extraxtSpaceNum = line2
          .substring(extractTextIndex + "indend_".length)
          .split(")")
          .find((val) => Number(val));
        dataList[index + 1] = null;
        dataList[index + 2] = null;
        dataList[index + 3] = null;
        dataList[index + 4] = null;
        dataList[index + 5] = null;
        dataList[index + 6] = null;
        dataList[index + 7] = null;
        dataList[index + 8] = null;
        isIntendStart = true;
        if (Number(extraxtSpaceNum)) {
          const space = `${Array(Number(extraxtSpaceNum))
            .fill("\xa0")
            .join("")}`;
          holeText = space + holeText;
        }
        return;
      }
      if (!isIntendStart) {
        return (holeText += word);
      }
    });
    finalXml += holeText;
  }
  const firstResult = await putNewLine(finalXml, true);
  if (firstResult) {
    unlink(resolve(__dirname, filePath), (err, data) => {
      if (err) {
        console.log("Error: unlink", err);
      }
    });
  }
  return { [type]: firstResult };
};

export default transFormXMLFile;
