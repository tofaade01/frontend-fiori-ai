sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("task-runtime.controller.TaskDetail", {
      _sCsrfToken: null,
      onInit: function () {
        const oModel = this.getOwnerComponent().getModel();
        oModel
          .bindList("/ContextNodes")
          .requestContexts()
          .then(
            function (aContexts) {
              var aData = aContexts.map(function (oContext) {
                return oContext.getObject(); // Returns JS object
              });

              //   Now aData is a plain JavaScript array -> can be used to create a JSONModel
              const oJSONModel = new JSONModel();
              oJSONModel.setData({ results: aData });

              // Use the JSON model as needed
              this.getOwnerComponent().setModel(oJSONModel, "myJSON");
              const data = this.getOwnerComponent()
                .getModel("myJSON")
                .getData().results;
              this.buildContextTree(data);

                const aTree = this._groupByPath(aData);
                const oTreeModel = new JSONModel({ nodes: aTree });
                this.getOwnerComponent().setModel(oTreeModel, "tree");
            }.bind(this)
          );
          const oUiModel = new JSONModel({
          busy: false,
          chatbot: {
            txtInput: "",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful AI Assistant who can help user queries about SAP technologies. Graciously answer questions not related to SAP too.",
              },
            ],
          },
        });
        this.getView().setModel(oUiModel, "ui");
      },
      onBtnChatbotSendPress: async function () {
        const oUiModel = this.getView().getModel("ui");
        const txtInput = oUiModel.getProperty("/chatbot/txtInput");
        if (!txtInput) return;

        const oMessages = [
          ...oUiModel.getProperty("/chatbot/messages"),
          {
            role: "user",
            content: txtInput,
          },
        ];

        oUiModel.setProperty("/chatbot/messages", oMessages);
        oUiModel.setProperty("/chatbot/txtInput", "");
        oUiModel.setProperty("/busy", true);

        const txtSummary = await this._apiChatLocal(oMessages);

        oMessages.push({
          role: "assistant",
          content: txtSummary,
        });

        oUiModel.setProperty("/chatbot/messages", oMessages);
        oUiModel.setProperty("/busy", false);
      },

      _apiChatLocal: async function (oMessages) {
        // this.byId("chatbotContent").setBusy(true);
        const YOUR_API_KEY = `AIzaSyCLanfVnyrRSehsD4vAmbz2QypIFev1BFo`
        const model = "models/gemini-2.0-flash"; // or "models/gemini-1.5-flash"
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${YOUR_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
            parts: oMessages.map((msg) => ({
              text: msg.content,
            })),
          },
            ]
          }),
        });
        const resData = await res.json();
        // this.byId("chatbotContent").setBusy(false);
        return resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      },
      
      buildContextTree: function (flatData) {
        // Result tree
        const treeData = {};

        flatData.forEach((item) => {
          const pathSegments = item.path.split("/").filter(Boolean); // e.g. ["documents", "section1"]
          let current = treeData;

          // Build hierarchy
          pathSegments.forEach((segment) => {
            if (!current[segment]) {
              current[segment] = {};
            }
            current = current[segment];
          });

          // Assign label-value pair
          current[item.label] = item.value;
        });

        const aTree = this.prepareTreeArray(treeData);
        const oTreeModel = new JSONModel({ nodes: aTree });
        this.getOwnerComponent().setModel(oTreeModel, "tree");
      },

      prepareTreeArray: function (oObj) {
        return Object.keys(oObj).map((key) => {
          const node = { key: key, children: [] };
          const val = oObj[key];
          if (val !== null && typeof val === "object") {
            // object → recurse
            node.children = this.prepareTreeArray(val);
          } else {
            // primitive → treat as leaf with a value
            node.value = val;
          }
          return node;
        });
      },

      _groupByPath: function (flatData) {
        const map = {};
        flatData.forEach((item) => {
          // strip leading slash
          const pathKey = item.path.replace(/^\/+/, "");
          if (!map[pathKey]) {
            map[pathKey] = { key: pathKey, children: [] };
          }
          // push each label/value as a leaf node
          map[pathKey].children.push({
            id: item.ID,
            key: item.label,
            value: item.value,
            children: [],
          });
        });
        console.log("map", map);
        // return array of all grouped nodes
        return Object.values(map);
      },

      _onLoadContextNodes: function (oData) {
        // oData.results is a flat array of ContextNode objects
        var aFlat = oData.results;
      },

      // ---------------------------------------Context Tree -------------------------------------
      // This is Detail page
      onContextNodesSelect: function () {
        // Get the reference to the author list control by its ID
        const oList = this.byId("docTree");

        // Get the currently selected item (author) from the list
        const oContextNodeSelected = oList.getSelectedItem();

        // If no author is selected, exit the function
        if (!oContextNodeSelected) {
          return;
        }

        // Retrieve the ID of the selected author from its binding context
        const sContextNodeId = oContextNodeSelected
          .getBindingContext("tree")
          .getProperty("id");
        // Call a private function to bind and display books related to the selected author
        this._bindContextNode(sContextNodeId);
      },

      _bindContextNode: function (sContextNodeId) {
        // Get a reference to the books table control by its ID
        const oForm = this.byId("ContextNodeForm");
        const oOtherForm = this.byId("BotInstanceForm");

        // If no author ID is provided, unbind the table and exit
        if (!sContextNodeId) {
          oForm.setVisible(false);
          oForm.unbindElement();
          return;
        } else {
          oForm.setVisible(true);
          oOtherForm.setVisible(false);
          // Bind the table items to the /Books entity set, filtered by the selected author's ID
          const sPath = "/ContextNodes('" + sContextNodeId + "')";

          oForm.bindElement({
            path: sPath,
          });
        }
      },
      // ---------------------------------------Context Tree -------------------------------------

      // -----------------------------------------Task Tree --------------------------------------
      // This is Detail page
      onTaskSelect: function () {
        // Get the reference to the author list control by its ID
        const oList = this.byId("TasksList");
      },

      // -----------------------------------------Task Tree --------------------------------------
    });
  }
);
