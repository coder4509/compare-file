import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { sortValidate } from "../services";

function SingleXML() {
  const [fileData, setFileData] = useState("");
  const [fileOutputData, setFileOuputData] = useState("");
  const onChange = React.useCallback((value, viewUpdate) => {
    setFileData(value);
  }, []);

  const sortValidateXML = () => {
    console.log(fileData);
    sortValidate(fileData)
      .then((res) => {
        console.log(res);
      })
      .catch((err) => {
        const {response} = err || {};
        const {data} = response;
        const {message} = data;
        alert(message);
      });
  };

  return (
    <div>
      <div className="button-center">
        <button onClick={sortValidateXML}>XML Sort & Validate</button>
      </div>
      <div className="sort-container">
        <div className="item-flex-1">
          <CodeMirror
            value={fileData}
            height="50rem"
            extensions={[xml()]}
            onChange={onChange}
          />
        </div>
        <div className="item-flex-small"></div>
        <div className="item-flex-1">
          <CodeMirror
            value={fileOutputData}
            height="50rem"
            extensions={[xml()]}
          />
        </div>
      </div>
    </div>
  );
}
export default SingleXML;
