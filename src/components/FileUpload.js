import React from "react";

const FileUpload = (props) => {
  const {setFileS, setFileNameS, setFileT, setFileNameT} = props;
  const saveFile = (e, pathOf = "") => {
    if (pathOf === "S") {
      setFileS(e.target.files[0]);
      setFileNameS(e.target.files[0].name);
    }

    if (pathOf === "T") {
      setFileT(e.target.files[0]);
      setFileNameT(e.target.files[0].name);
    }
  };

  return (
    <div className="file-upload-section">
      <div>
        <label>Source File</label>
        <input type="file" onChange={(e) => saveFile(e, "S")} />
      </div>

      <div>
        <label>Target File</label>
        <input type="file" onChange={(e) => saveFile(e, "T")} />
      </div>
    </div>
  );
};

export default FileUpload;
