import React, { useState, useEffect, useCallback } from "react";
import Form from "@rjsf/core";
import Ajv from "ajv";
import validator from "@rjsf/validator-ajv8";
import { dump as yamlDump } from "js-yaml";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faEye, faBook, faShareAlt, faToggleOn, faToggleOff } from "@fortawesome/free-solid-svg-icons";
// import firewallRulesRawSchema from "./schemas/Boss Communication Assistant/v1.0.0.json";
// import firewallRulesUISchema from './schemas/UISchema.json';
import "./modal.css";
import "./main.css";
import "./prompts.css";
import "bootstrap/dist/css/bootstrap.min.css";

// Initialize AJV with options suitable for your needs
const ajv = new Ajv({ strict: true, allErrors: true, useDefaults: true });
const addFormats = require("ajv-formats");
addFormats(ajv, ["email"]);

// const validate = ajv.compile(firewallRulesRawSchema);

// const schema = {
//   type: "object",
//   properties: {
//     schema_data: {},
//   },
// };

function DescriptionFieldTemplate(props) {
  const { description } = props;
  return description ? (
    <div className="field-description">
      <p className="description">{description}</p>
    </div>
  ) : null;
}

// function DescriptionFieldTemplate(props) {
//   return null; // Ensure you have a valid return for all your components, even if null
// }

function formatErrors(errors) {
  return errors
    .filter((error) => error.keyword !== "const" && error.keyword !== "x") // Good practice to filter out unnecessary errors
    .map((error) => `${error.instancePath} => ${error.schemaPath}`)
    .join("\n"); // Joining errors with newline for better readability
}

function App() {
  const [formData, setFormData] = useState({});
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [schema, setSchema] = useState(null);
  const [schemaFolders, setSchemaFolders] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [isInputValid, setIsInputValid] = useState(true);
  const [liveValidate, setLiveValidate] = useState(true);
  const [validateSchema, setValidateSchema] = useState(true);
  const [modalInputData, setModalInputData] = useState("");
  const [errorTitle, setErrorTitle] = useState("");
  const [selectedAssistant, setSelectedAssistant] = useState("");

  // const uiSchema = {
  //   'firewall_rules': firewallRulesUISchema,
  //   'ui:submitButtonOptions': {
  //     norender: { liveValidate },
  //     submitText: "Validate"
  //   },
  // };

  const [uiSchema, setUiSchema] = useState({
    "ui:submitButtonOptions": {
      norender: liveValidate,
      submitText: "Validate",
    },
  });

  useEffect(() => {
    // Update the uiSchema whenever liveValidate changes
    setUiSchema({
      "ui:submitButtonOptions": {
        norender: liveValidate,
        submitText: "Validate",
      },
    });
  }, [liveValidate]); // This effect runs when `liveValidate` changes

  // Reset form data to initial state
  const resetFormData = () => {
    setFormData({});
  };

  // Copy JSON to clipboard
  const copyJsonToClipboard = (formData) => {
    try {
      // Convert the schema_data to YAML
      const yamlStr = yamlDump(formData.schema_data, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
        noRefs: true, // Don't use references
        sortKeys: false, // Preserve key order
      });

      // Copy to clipboard
      navigator.clipboard.writeText(yamlStr).catch((err) => {
        console.error("Could not copy text: ", err);
      });
    } catch (err) {
      console.error("Error converting to YAML: ", err);
    }
  };

  // Generate and copy the shareable link
  const shareFormData = () => {
    const base64EncodedData = btoa(JSON.stringify(formData.firewall_rules));
    const currentUrl = window.location.href.split("?")[0];
    const shareableLink = `${currentUrl}?formData=${base64EncodedData}`;

    navigator.clipboard.writeText(shareableLink).catch((err) => {
      console.error("Failed to copy shareable link: ", err);
    });
  };

  // Load JSON from modal
  const loadJsonFromModal = async () => {
    try {
      const formData = JSON.parse(modalInputData);
      setFormData({ firewall_rules: formData });
      toggleModal();
    } catch (err) {
      console.error("Failed to load JSON from clipboard:", err);
    }
  };

  // Validate modal text area
  const validateModalTextArea = useCallback(() => {
    if (!validateSchema) {
      setIsInputValid(true);
      setErrorTitle("");
      return;
    }
    try {
      const inputData = JSON.parse(modalInputData);
      const valid = validate(inputData);
      setIsInputValid(valid);
      setErrorTitle(valid ? "" : formatErrors(validate.errors));
    } catch (err) {
      setIsInputValid(false);
      setErrorTitle(err.toString());
    }
  }, [validateSchema, modalInputData]);

  // Effect to validate the modal text area when `validateSchema` or `modalInputData` changes
  useEffect(() => {
    validateModalTextArea();
  }, [validateModalTextArea]);

  // Handle form data change
  const handleFormDataChange = ({ formData }) => {
    setFormData(formData);
  };

  // Parse Query Param and load state into form
  useEffect(() => {
    const parseAndCleanQueryParams = () => {
      const queryParams = new URLSearchParams(window.location.search);
      const formDataParam = queryParams.get("formData");
      if (formDataParam) {
        try {
          const decodedData = JSON.parse(atob(formDataParam));
          setFormData({ firewall_rules: decodedData });
          // Remove the query parameter from the URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        } catch (error) {
          console.error("Error decoding formData from URL parameter:", error);
        }
      }
    };

    parseAndCleanQueryParams();
  }, []);

  // Handle modal input change
  const handleModalInputChange = (e) => {
    const input = e.target.value;
    setModalInputData(input);
    // Optionally, validate as user types or on input change
    // validateModalTextArea();
  };

  // Toggle modal visibility
  const toggleModal = () => {
    setShowModal(!showModal);
    if (!showModal) {
      // Pre-fill modal with current formData when opening
      setModalInputData(JSON.stringify(formData.firewall_rules, null, 2));
    }
  };

  // Add this effect to dynamically load schema folders and versions
  useEffect(() => {
    async function loadSchemaStructure() {
      try {
        // This will use webpack's require.context to scan the schemas directory
        const schemaContext = require.context("./schemas", true, /v\d+\.\d+\.\d+\.json$/);

        // Create a map to store folder structure
        const folders = {};

        schemaContext.keys().forEach((key) => {
          // Extract folder name and version from path
          // New path format: ./Boss Communication Assistant/v1.0.0.json
          const pathParts = key.split("/");
          const folderName = pathParts[1];
          const versionMatch = pathParts[2].match(/v(\d+\.\d+\.\d+)\.json$/);

          if (folderName && versionMatch) {
            const version = versionMatch[1];

            if (!folders[folderName]) {
              folders[folderName] = {
                versions: [],
                path: folderName,
              };
            }

            if (!folders[folderName].versions.includes(version)) {
              folders[folderName].versions.push(version);
            }
          }
        });

        // Sort versions for each folder
        Object.keys(folders).forEach((folder) => {
          folders[folder].versions.sort((a, b) => {
            const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
            const [bMajor, bMinor, bPatch] = b.split(".").map(Number);

            if (aMajor !== bMajor) return bMajor - aMajor;
            if (aMinor !== bMinor) return bMinor - aMinor;

            return bPatch - aPatch;
          });
        });

        setSchemaFolders(folders);
      } catch (error) {
        console.error("Error loading schema structure:", error);
      }
    }

    loadSchemaStructure();
  }, []);

  // Update the schema loading effect to use the new file structure
  useEffect(() => {
    async function loadSchema() {
      if (selectedAssistant && selectedVersion) {
        console.log("Folder selected", selectedAssistant, "Version selected", selectedVersion);
        console.log("Loading schema", `./schemas/${schemaFolders[selectedAssistant].path}/v${selectedVersion}.json`);
        try {
          const schemaModule = await import(
            /* webpackInclude: /\.json$/ */
            `./schemas/${schemaFolders[selectedAssistant].path}/v${selectedVersion}.json`
          );
          const uiSchemaModule = await import(
            /* webpackInclude: /\.json$/ */
            `./schemas/${schemaFolders[selectedAssistant].path}/ui_schema.json`
          );

          setSchema({
            type: "object",
            properties: {
              schema_data: schemaModule.default,
            },
          });
          console.log("Schema", schemaModule.default);
          // Combine the loaded UI schema with the submit button options
          setUiSchema({
            schema_data: uiSchemaModule.default,
            "ui:submitButtonOptions": {
              norender: liveValidate,
              submitText: "Validate",
            },
          });
        } catch (error) {
          console.error("Error loading schema:", error);
        }
      }
    }
    loadSchema();
  }, [selectedAssistant, selectedVersion]);

  return (
    <div className="app-container">
      <div className="selector-container">
        <h1 className="boss-communication-header">Dynamic Prompt Assistant</h1>

        <div className="action-buttons">
          <button className="action-button share-button" onClick={shareFormData}>
            <FontAwesomeIcon icon={faShareAlt} /> Share
          </button>
          <button className="action-button copy-button" onClick={() => copyJsonToClipboard(formData)}>
            <FontAwesomeIcon icon={faCopy} /> Copy
          </button>
          <button className="action-button view-button">
            <FontAwesomeIcon icon={faEye} /> View
          </button>
          <button className="action-button reset-button" onClick={resetFormData}>
            Reset Form
          </button>
        </div>

        <div className="selector-wrapper">
          <select className="form-select" value={selectedAssistant} onChange={(e) => setSelectedAssistant(e.target.value)}>
            <option value="">Select Assistant Type</option>
            {Object.keys(schemaFolders).map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            disabled={!selectedAssistant}
            onClick={resetFormData}
          >
            <option value="">Select Version</option>
            {selectedAssistant &&
              schemaFolders[selectedAssistant].versions.map((version) => (
                <option key={version} value={version}>
                  v{version}
                </option>
              ))}
          </select>

          {selectedAssistant && selectedVersion && schema && (
            <div className="last-updated">Last Updated: {schema.properties.schema_data.last_updated}</div>
          
          )}
        </div>

        {selectedAssistant && selectedVersion && schema ? (
          <div className="form-content">
            <Form
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={handleFormDataChange}
              liveValidate={liveValidate}
              validator={validator}
              templates={{
                DescriptionFieldTemplate,
              }}
            />
          </div>
        ) : (
          <div className="selection-message">Please select an assistant type and version to begin</div>
        )}
      </div>
    </div>
  );
}

export default App;
