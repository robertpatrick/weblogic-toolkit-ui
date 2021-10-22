/**
 * @license
 * Copyright (c) 2021, Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
'use strict';

/**
 * An object which performs domain discovery.
 * Returns a singleton.
 */

define(['knockout', 'models/wkt-project', 'models/wkt-console', 'utils/dialog-helper', 'utils/project-io', 'utils/i18n',
  'utils/validation-helper', 'utils/wkt-logger', 'ojs/ojbootstrap', 'ojs/ojknockout', 'ojs/ojbutton', 'ojs/ojdialog'],
function (ko, project, wktConsole, dialogHelper, projectIO, i18n, validationHelper, wktLogger) {
  function WktDiscoverer() {

    // validate Java home and Oracle home settings.
    // save the current project (electron will select a new file if needed).
    // open the discover configuration dialog.
    this.startDiscoverDomain = async (online) => {
      const discoverConfig = {'online': online};
      dialogHelper.openDialog('discover-dialog', discoverConfig);
    };

    // the dialog will call this when the OK button is clicked.
    this.executeDiscover = async (discoverConfig, online) => {
      const errTitleKey = online ? 'discover-dialog-online-aborted-error-title' : 'discover-dialog-offline-aborted-error-title';
      let errTitle = i18n.t(errTitleKey);
      const keyName = online ? 'flow-online-discover-model-name' : 'flow-offline-discover-model-name';
      const validationObject = this.getValidationObject(keyName, discoverConfig, online);
      if (validationObject.hasValidationErrors()) {
        const validationErrorDialogConfig = validationObject.getValidationErrorDialogConfig(errTitle);
        dialogHelper.openDialog('validation-error-dialog', validationErrorDialogConfig);
        return Promise.resolve(false);
      }

      const totalSteps = 5.0;
      try {
        let busyDialogMessage = i18n.t('flow-validate-java-home-in-progress');
        dialogHelper.openBusyDialog(busyDialogMessage, 'bar', 0.0);
        const javaHomeDirectory = discoverConfig.javaHome;
        const oracleHomeDirectory = discoverConfig.oracleHome;
        const domainHomeDirectory = discoverConfig.domainHome;

        let errContext = i18n.t('discover-dialog-invalid-java-home-error-prefix');
        const javaHomeValidationResult =
          await window.api.ipc.invoke('validate-java-home', javaHomeDirectory, errContext);
        if (!javaHomeValidationResult.isValid) {
          const errMessage = javaHomeValidationResult.reason;
          dialogHelper.closeBusyDialog();
          await window.api.ipc.invoke('show-error-message', errTitle, errMessage);
          return Promise.resolve(false);
        }

        busyDialogMessage = i18n.t('flow-validate-oracle-home-in-progress');
        dialogHelper.updateBusyDialog(busyDialogMessage, 1/totalSteps);
        errContext = i18n.t('discover-dialog-invalid-oracle-home-error-prefix');
        const oracleHomeValidationResult = await window.api.ipc.invoke('validate-oracle-home', oracleHomeDirectory, errContext);
        if (!oracleHomeValidationResult.isValid) {
          const errMessage = oracleHomeValidationResult.reason;
          dialogHelper.closeBusyDialog();
          await window.api.ipc.invoke('show-error-message', errTitle, errMessage);
          return Promise.resolve(false);
        }

        busyDialogMessage = i18n.t('flow-validate-domain-home-in-progress');
        dialogHelper.updateBusyDialog(busyDialogMessage, 2/totalSteps);
        errContext = i18n.t('discover-dialog-invalid-domain-home-error-prefix');
        const domainHomeValidationResult = await window.api.ipc.invoke('validate-domain-home', domainHomeDirectory, errContext);
        if (!domainHomeValidationResult.isValid) {
          const errMessage = domainHomeValidationResult.reason;
          dialogHelper.closeBusyDialog();
          await window.api.ipc.invoke('show-error-message', errTitle, errMessage);
          return Promise.resolve(false);
        }

        busyDialogMessage = i18n.t('flow-save-project-in-progress');
        dialogHelper.updateBusyDialog(busyDialogMessage, 3/totalSteps);
        const saveResult = await projectIO.saveProject();
        if (!saveResult.saved) {
          const errMessage = `${i18n.t('discover-dialog-project-not-saved-error-prefix')}: ${saveResult.reason}`;
          dialogHelper.closeBusyDialog();
          await window.api.ipc.invoke('show-error-message', errTitle, errMessage);
          return Promise.resolve(false);
        }
        // Now that the project file is saved to disk, make sure all of the file names are set.
        discoverConfig.projectFile = project.getProjectFileName();
        if (!discoverConfig.modelFile) {
          discoverConfig.modelFile = project.wdtModel.getDefaultModelFile();
        }
        if (!discoverConfig.propertiesFile) {
          discoverConfig.propertiesFile = project.wdtModel.getDefaultPropertiesFile();
        }
        if (!discoverConfig.archiveFile) {
          discoverConfig.archiveFile = project.wdtModel.getDefaultArchiveFile();
        }

        wktConsole.clear();
        wktConsole.show(true);

        busyDialogMessage = i18n.t('flow-discover-domain-in-progress');
        dialogHelper.updateBusyDialog(busyDialogMessage, 4/totalSteps);
        const channel = online ? 'run-online-discover' : 'run-offline-discover';
        const discoverResults = await window.api.ipc.invoke(channel, discoverConfig);
        if (discoverResults.isSuccess) {
          wktLogger.debug('discover complete: %s', discoverResults.modelFileContent);
          project.wdtModel.setModelFiles(discoverResults.modelFileContent);
          return Promise.resolve(true);
        } else {
          let errMessage;
          if (online) {
            errMessage = `${i18n.t('discover-dialog-online-discovery-failed-error-prefix',
              { adminUrl: discoverConfig.adminUrl})}: ${discoverResults.reason}`;
          } else {
            errMessage = `${i18n.t('discover-dialog-offline-discovery-failed-error-prefix',
              { domainHome: domainHomeDirectory})}: ${discoverResults.reason}`;
          }
          dialogHelper.closeBusyDialog();
          await window.api.ipc.invoke('show-error-message', errTitle, errMessage);
          return Promise.resolve(false);
        }
      } catch (err) {
        dialogHelper.closeBusyDialog();
        throw err;
      } finally {
        dialogHelper.closeBusyDialog();
      }
    };

    this.getValidationObject = (flowNameKey, discoverConfig, online) => {
      const validationObject = validationHelper.createValidatableObject(flowNameKey);
      validationObject.addField('project-settings-java-home-label',
        validationHelper.validateRequiredField(discoverConfig.javaHome));
      validationObject.addField('project-settings-oracle-home-label',
        validationHelper.validateRequiredField(discoverConfig.oracleHome));
      validationObject.addField('discover-dialog-domain-label',
        validationHelper.validateRequiredField(discoverConfig.domainHome));

      if (online) {
        validationObject.addField('discover-dialog-admin-url-label',
          validationHelper.validateRequiredField(discoverConfig.adminUrl));
        validationObject.addField('discover-dialog-admin-user-label',
          validationHelper.validateRequiredField(discoverConfig.adminUser));
        validationObject.addField('discover-dialog-admin-password-label',
          validationHelper.validateRequiredField(discoverConfig.adminPass));
      }
      return validationObject;
    };
  }

  return new WktDiscoverer();
});