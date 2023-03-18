import { existsSync, readFileSync, writeFileSync } from "fs";
import uniqid from "uniqid";
import moment from "moment";
import { resolve } from "path";

const createCollection = (existDbPath, name) => {
  const dbPath = existDbPath;
  if (name) {
    const dbData = readFileSync(dbPath, "utf-8");
    if (dbData) {
      const createCollection = JSON.parse(dbData);
      createCollection.push({
        collection: name,
        data: { created: moment().utc(true) },
        lastUpdatedBy: []
      });
      writeFileSync(existDbPath, JSON.stringify(createCollection), "utf-8");
    }
  }
};

const insertCollection = (existDbPath, name, collectionKeys) => {
  if (name) {
    const dbData = readFileSync(existDbPath, "utf-8");
    if (dbData && collectionKeys && typeof collectionKeys === "object") {
      const collectionData = JSON.parse(dbData) || [];
      const findCollectionIndex = collectionData.findIndex((col) => {
        return col.collection === name;
      });

      if (findCollectionIndex === -1) {
        throw new Error(`Collection: '${name}' not found`);
      }

      const oldData = collectionData[findCollectionIndex].data;
      const newData = {
        ...oldData,
        ...collectionKeys,
        id: uniqid(),
        inserted: moment().utc(true),
      };
      collectionData[findCollectionIndex].data = newData;
      if (!Array.isArray(collectionData[findCollectionIndex].lastUpdatedBy)) {
        collectionData[findCollectionIndex].lastUpdatedBy = []; 
      }
      const activeRecordArray = collectionData[findCollectionIndex].lastUpdatedBy.map((item) => {
          item['active'] = -1;
          return item;
      });
      collectionData[findCollectionIndex].lastUpdatedBy = [...activeRecordArray];
      collectionData[findCollectionIndex].lastUpdatedBy.push({...collectionKeys, id: newData.id, updateDate: newData.inserted, active: 1})
      writeFileSync(existDbPath, JSON.stringify(collectionData), "utf-8");
    }
  }
};

const findCollection = (existDbPath, name) => {
  const dbPath = existDbPath;
  if (name) {
    const dbData = readFileSync(dbPath, "utf-8");
    if (dbData) {
      const collectionData = JSON.parse(dbData) || [];
      const dataCol = collectionData.find((col) => col.collection === name);
      return { exists: Boolean(dataCol), data: dataCol };
    }
    return {};
  }
};

const deleteCollection = () => {};

const updateCollection = () => {};

const deleteDb = () => {};

const initDB = () => {
  const existDbFile = resolve(__dirname, "local.db.json");
  if (!existsSync(existDbFile)) {
    writeFileSync(existDbFile, JSON.stringify([]), "utf-8");
  }
  return {
    create: (name) => {
      return createCollection(existDbFile, name);
    },
    insert: (name, collectionObj) => {
      return insertCollection(existDbFile, name, collectionObj);
    },
    delete: (name) => {
      return deleteCollection(existDbFile);
    },
    update: (name) => {
      return updateCollection(existDbFile);
    },
    deleteDB: (name) => {
      return deleteDb(existDbFile);
    },
    find: (name) => {
      return findCollection(existDbFile, name);
    },
  };
};

export default initDB;
