/**
 * The full UI string-key set (spec 015 FR-008, research.md §6) — every one of
 * the six dictionaries (`en.ts`, `it.ts`, `ru.ts`, `fr.ts`, `de.ts`, `es.ts`)
 * implements this exact shape. Parameterized strings are functions instead
 * of plain values, so interpolated values (file names, counts, messages)
 * stay outside the translated text itself.
 */
export interface Dictionary {
  init: {
    setupTitle: string;
    setupDescription: string;
    languagePrompt: string;
    submit: string;
    unexpectedStateTitle: string;
    unexpectedStateBody: string;
    mcpConnect: {
      readyTitle: string;
      connectTitle: string;
      justCreatedText: string;
      step1: string;
      step2: string;
      step3: string;
      reviewText: string;
      goToEditor: string;
    };
    submitUnauthorized: string;
    submitInvalidLanguage: string;
    envSetup: {
      title: string;
      description: string;
      storageHeading: string;
      endpoint: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      pathStyleLabel: string;
      ownerHeading: string;
      ownerDescription: string;
      username: string;
      password: string;
      systemNameHeading: string;
      systemNameLabel: string;
      messagingHeading: string;
      messagingDescription: string;
      smtpSubheading: string;
      smtpHost: string;
      smtpPort: string;
      smtpSecureLabel: string;
      smtpUser: string;
      smtpPassword: string;
      smtpFrom: string;
      telegramSubheading: string;
      telegramBotToken: string;
      telegramChatId: string;
      rateLimitSubheading: string;
      rateLimitMax: string;
      rateLimitWindowMinutes: string;
      configHeading: string;
      copy: string;
      copied: string;
      applyHeading: string;
      applyLocallyLabel: string;
      applyLocallyText: string;
      applyVercelLabel: string;
      applyVercelText: string;
      reloadNote: string;
    };
  };
  editor: {
    tree: {
      loading: string;
      empty: string;
      menuNewFile: string;
      menuNewFolder: string;
      menuUploadFiles: string;
      menuUploadFolder: string;
      menuDownloadZip: string;
      menuDeleteFolder: string;
      menuDelete: string;
      moreActions: string;
      promptNewFile: string;
      promptNewFolder: string;
      invalidName: (name: string) => string;
      nothingToUpload: string;
      nothingToUploadFiltered: (skipped: number) => string;
      overwriteFilesConfirm: (names: string) => string;
      uploadFailed: (message: string) => string;
      uploadFailedLabel: string;
      uploadSummary: (uploaded: number, skipped: number) => string;
      uploadSummaryFailedSuffix: (failedList: string) => string;
      downloadFailed: (message: string) => string;
      downloadNothing: string;
      deleteFileConfirm: (name: string) => string;
      deleteFailed: (message: string) => string;
      deleteFailedLabel: string;
      overwriteFileConfirm: (name: string) => string;
      createFailed: (message: string) => string;
      createFailedLabel: string;
      deleteFolderConfirm: (name: string) => string;
      dirLoadFailed: string;
    };
    file: {
      selectPrompt: string;
      loading: (path: string) => string;
      preview: string;
      table: string;
      edit: string;
      raw: string;
      unsavedChanges: string;
      save: string;
      saving: string;
      saved: string;
      saveFailed: (message: string) => string;
      saveFailedLabel: string;
      discardConfirm: string;
      loadFailed: string;
      openedPathIsFolder: (path: string) => string;
      externalChangeMessage: string;
      externalChangeReload: string;
      externalChangeKeepMine: string;
    };
    csv: {
      empty: string;
      summary: (rows: number, columns: number) => string;
      truncated: (shown: number, total: number) => string;
      noRows: string;
    };
    header: {
      toggleSidebar: string;
    };
  };
  settings: {
    connectedApps: {
      title: string;
      empty: string;
      client: string;
      status: string;
      authorized: string;
      lastUsed: string;
      never: string;
      revoke: string;
      signOut: string;
    };
    pat: {
      title: string;
      description: string;
      empty: string;
      name: string;
      status: string;
      created: string;
      lastUsed: string;
      never: string;
      revoked: string;
      active: string;
      revoke: string;
      createTitle: string;
      namePlaceholder: string;
      generate: string;
      createdTitle: string;
      createdBody: string;
      backLink: string;
    };
  };
  tools: {
    title: string;
    description: string;
    name: string;
    group: string;
    status: string;
    active: string;
    disabled: string;
    signOut: string;
    disableAction: string;
    enableAction: string;
    confirmTitle: string;
    confirmPendingChange: (name: string, to: string) => string;
    confirmButton: string;
    cancelButton: string;
    warningNotice: string;
    changedBanner: (name: string, to: string) => string;
    changeFailed: (message: string) => string;
  };
  oauth: {
    login: {
      title: string;
      description: string;
      username: string;
      password: string;
      submit: string;
      errorInvalidCredentials: string;
      errorLockedOut: string;
      errorGeneric: string;
    };
    authorize: {
      title: string;
      requesting: (clientName: string) => string;
      approve: string;
      deny: string;
      cantContinue: string;
      errorMissingParams: string;
      errorUnsupportedChallenge: string;
      errorUnknownClient: string;
    };
  };
}
