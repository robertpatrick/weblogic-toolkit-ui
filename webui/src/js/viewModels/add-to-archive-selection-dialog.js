/**
 * @license
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
 * Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/
 */
'use strict';

define(['accUtils', 'knockout', 'utils/i18n', 'models/wkt-project', 'utils/dialog-helper', 'utils/wdt-archive-helper',
  'ojs/ojarraydataprovider', 'utils/wkt-logger', 'ojs/ojknockout', 'ojs/ojinputtext', 'ojs/ojlabel', 'ojs/ojbutton',
  'ojs/ojdialog', 'ojs/ojformlayout', 'ojs/ojselectsingle', 'ojs/ojvalidationgroup', 'ojs/ojradioset'],
function(accUtils, ko, i18n, project, dialogHelper, archiveHelper, ArrayDataProvider, wktLogger) {

  const jqueryDialogName = '#addToArchiveSelectionDialog';

  function AddToArchiveSelectionDialogModel() {

    let subscriptions = [];

    this.connected = () => {
      accUtils.announce('Add to archive selection dialog loaded.', 'assertive');

      subscriptions.push(this.archiveEntryType.subscribe((newEntryKey) => {
        this.handleArchiveEntryTypeChange(newEntryKey);
      }));

      // open the dialog after the current thread, which is loading this view model.
      // using oj-dialog initial-visibility="show" causes vertical centering issues.
      setTimeout(function() {
        $(jqueryDialogName)[0].open();
      }, 1);
    };

    this.disconnected = () => {
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
    };

    this.labelMapper = (labelId, arg) => {
      if (arg) {
        return i18n.t(`add-to-archive-selection-dialog-${labelId}`, arg);
      }
      return i18n.t(`add-to-archive-selection-dialog-${labelId}`);
    };

    this.anyLabelMapper = (labelId, arg) => {
      if (arg) {
        return i18n.t(labelId, arg);
      }
      return i18n.t(labelId);
    };

    this.wktLogger = wktLogger;
    this.archiveEntryTypes = ko.observableArray();
    this.archiveEntryTypesProvider = new ArrayDataProvider(this.archiveEntryTypes, {keyAttributes: 'key'});
    this.entryTypesMap = null;

    archiveHelper.getEntryTypes().then(entryTypes => {
      this.entryTypesMap = entryTypes;

      // Must initialize these here since the data retrieval is async...
      //
      this.initializeCustomPathLabelAndHelp();
      this.initializeCoherencePersistenceDirectoryType();

      for (const [key, value] of Object.entries(entryTypes)) {
        this.archiveEntryTypes.push({key: key, label: value.name, ...value});
        this.archiveEntryTypes.sort((a, b) => (a.label > b.label) ? 1 : -1);
      }
    });

    this.archiveEntryType = ko.observable();
    this.archiveEntry = ko.observable();
    this.archiveEntryTypeSubtype = ko.observable();
    this.fileOrDirectory = ko.observable('file');

    this.getFileOrDirectoryValue = () => {
      let type = this.archiveEntryTypeSubtype();
      if (type === 'either') {
        type = this.fileOrDirectory();
      } else if (type === 'emptyDir') {
        type = undefined;
      }
      return type;
    };

    this.fileNameSourcePath = ko.observable();
    this.fileNameSourceLabel = ko.computed(() => {
      const type = this.getFileOrDirectoryValue();
      if (!!type) {
        return this.archiveEntry()[`${type}Label`];
      }
      return undefined;
    }, this);
    this.fileNameSourceHelp = ko.computed(() => {
      const type = this.getFileOrDirectoryValue();
      if (!!type) {
        return this.archiveEntry()[`${type}Help`];
      }
      return undefined;
    }, this);

    this.segregationName = ko.observable();
    this.segregationLabel = ko.computed(() => {
      const entry = this.archiveEntry();
      if (!!entry) {
        return entry.segregatedLabel;
      }
      return undefined;
    }, this);
    this.segregationHelp = ko.computed(() => {
      const entry = this.archiveEntry();
      if (!!entry) {
        return entry.segregatedHelp;
      }
      return undefined;
    }, this);

    this.emptyDirValue = ko.observable();
    this.emptyDirLabel = ko.computed(() => {
      const entry = this.archiveEntry();
      if (!!entry) {
        return entry.emptyDirLabel;
      }
      return undefined;
    }, this);
    this.emptyDirHelp = ko.computed(() => {
      const entry = this.archiveEntry();
      if (!!entry) {
        return entry.emptyDirLabel;
      }
      return undefined;
    }, this);
    this.emptyDirIsSelect =
      ko.computed(() => this.archiveEntryType() === 'coherencePersistenceDirectory', this);

    this.customPathValue = ko.observable();
    this.customPathLabel = undefined;
    this.customPathHelp = undefined;

    this.coherencePersistenceDirectoryTypes = undefined;
    this.coherencePersistenceDirectoryTypesDP = undefined;

    this.fileDirectoryRadioButtonData = [
      { id: 'file', value: 'file', label: this.labelMapper('file-label')},
      { id: 'dir',  value: 'dir',  label: this.labelMapper('directory-label')}
    ];
    this.fileDirectoryRadioButtonsDP =
      new ArrayDataProvider(this.fileDirectoryRadioButtonData, { keyAttributes: 'id' });

    this.getEntryForType = (entryType) => {
      return this.entryTypesMap[entryType];
    };

    this.initializeCustomPathLabelAndHelp = () => {
      const customEntry = this.getEntryForType('custom');
      this.customPathLabel = ko.observable(customEntry.pathLabel);
      this.customPathHelp = ko.observable(customEntry.pathHelp);
    };

    this.initializeCoherencePersistenceDirectoryType = () => {
      const coherencePersistenceDirectoryEntry = this.getEntryForType('coherencePersistenceDirectory');
      this.coherencePersistenceDirectoryTypes = ko.observableArray(coherencePersistenceDirectoryEntry.subtypeChoices);
      this.coherencePersistenceDirectoryTypesDP =
        new ArrayDataProvider(this.coherencePersistenceDirectoryTypes, { keyAttributes: 'name' });
    };

    this.handleArchiveEntryTypeChange = (newEntryKey) => {
      const newEntry = this.getEntryForType(newEntryKey);
      this.archiveEntry(newEntry);
      this.archiveEntryTypeSubtype(newEntry.subtype);
      this.fileOrDirectory('file');
      this.fileNameSourcePath(undefined);
      this.segregationName(undefined);
      this.emptyDirValue(undefined);
      this.customPathValue(undefined);
    };

    this.showFileNameChooser = ko.computed(() => this.archiveEntryTypeSubtype() !== 'emptyDir', this);
    this.showFileOrDirectorySelector = ko.computed(() => this.archiveEntryTypeSubtype() === 'either', this);
    this.sourceFileNameIsFile = ko.computed(() => this.getFileOrDirectoryValue() === 'file', this);
    this.sourceFileNameIsDir = ko.computed(() => this.getFileOrDirectoryValue() === 'dir', this);
    this.showSegregatedNameField = ko.computed(() => {
      const entry = this.archiveEntry();
      if (!!entry) {
        return !!entry.segregatedLabel;
      }
      return false;
    }, this);
    this.showEmptyDirField = ko.computed(() => this.archiveEntryTypeSubtype() === 'emptyDir', this);
    this.showCustomPathField = ko.computed(() => this.archiveEntryType() === 'custom', this);

    this.segregatedNameValidator = {
      validate: (value) => {
        if (value && value.includes('/')) {
          throw new Error(this.labelMapper('name-no-forward-slashes'));
        }
      }
    };

    this.customPathValidator = {
      validate: (value) => {
        if (value && (value.startsWith('/') || value.endsWith('/'))) {
          throw new Error(this.labelMapper('path-no-leading-trailing-forward-slashes'));
        }
      }
    };

    this.chooseSourceLocation = async () => {
      const fileChosen = await archiveHelper.chooseArchiveEntryFile(this.archiveEntryType(),
        this.getFileOrDirectoryValue(), this.archiveEntry().extensions, this.fileNameSourcePath());

      if (!!fileChosen) {
        this.fileNameSourcePath(fileChosen);
      }
    };

    this.addToArchive = async () => {
      let tracker = document.getElementById('tracker');

      if (tracker.valid === 'valid') {
        const options = archiveHelper.buildAddToArchiveOptions(this.archiveEntryType(), this.archiveEntry(),
          this.fileNameSourcePath(), this.fileOrDirectory(), {
            emptyDirName: this.emptyDirValue(),
            segregationName: this.segregationName(),
            customPath: this.customPathValue()
          });

        wktLogger.debug(`Calling addToArchive for entry type ${this.archiveEntryType()} with options: ${JSON.stringify(options)}`);
        archiveHelper.addToArchive(this.archiveEntryType(), options).then(() => {
          $(jqueryDialogName)[0].close();
        }).catch(err => {
          dialogHelper.displayCatchAllError('add-archive-entry', err).then();
        });
      } else {
        tracker.showMessages();
        tracker.focusOn('@firstInvalidShown');
      }
    };

    this.cancelAdd = () => {
      $(jqueryDialogName)[0].close();
    };
  }

  /*
   * Returns a constructor for the ViewModel.
   */
  return AddToArchiveSelectionDialogModel;
});
