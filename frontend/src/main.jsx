import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { startQueueWorker } from "./offline/uploadQueue";
import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/admin.css";

// Sends any walkthrough photos left in the offline queue (see
// offline/uploadQueue.js) whenever the app is open and online.
startQueueWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
