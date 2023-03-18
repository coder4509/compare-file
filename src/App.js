import React, { useEffect, useState } from "react";
import { Home, SingleXML, EnvUpdate } from "./module";

function App() {
  const [isSingleView, setIsSingleView] = useState(false);
  const [isEnvUpdateView, setEnvUpdateView] = useState(false);
  useEffect(() => {
    // if (window && window.location.pathname === "/single/xml") {
    //   setIsSingleView(true);
    // }
    // if (window && window.location.pathname === "/update/env") {
    //   setEnvUpdateView(true);
    // }
  }, []);

  const renderView = () => {
      return <Home />;
  };

  return (
    <React.Fragment>
      <div>{renderView()}</div>
    </React.Fragment>
  );
}

export default App;
