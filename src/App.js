import React, { useEffect, useState } from "react";
import { Home, SingleXML } from "./module";

function App() {
  const [isSingleView, setIsSingleView] = useState(false);
  useEffect(() => {
    if (window && window.location.pathname === "/single/xml") {
      setIsSingleView(true);
    }
  }, []);

  return (
    <React.Fragment>
      <div>{isSingleView ? <SingleXML /> : <Home />}</div>
    </React.Fragment>
  );
}

export default App;
