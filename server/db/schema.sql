-- CBC Competency Tracking System schema
-- Mirrors the corrected ER diagram / database schema in Design_Diagrams_Corrected.docx

CREATE TABLE IF NOT EXISTS School (
  SchoolID    INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL,
  Location    TEXT
);

CREATE TABLE IF NOT EXISTS User (
  UserID      INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL,
  Email       TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  Role        TEXT NOT NULL CHECK (Role IN ('teacher','administrator')),
  SchoolID    INTEGER NOT NULL REFERENCES School(SchoolID)
);

CREATE TABLE IF NOT EXISTS Teacher (
  UserID      INTEGER PRIMARY KEY REFERENCES User(UserID) ON DELETE CASCADE,
  TSCNumber   TEXT
);

CREATE TABLE IF NOT EXISTS Administrator (
  UserID      INTEGER PRIMARY KEY REFERENCES User(UserID) ON DELETE CASCADE,
  Department  TEXT
);

CREATE TABLE IF NOT EXISTS Learner (
  LearnerID   INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL,
  GradeLevel  TEXT NOT NULL,
  SchoolID    INTEGER NOT NULL REFERENCES School(SchoolID)
);

CREATE TABLE IF NOT EXISTS Strand (
  StrandID    INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Sub_Strand (
  SubStrandID INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL,
  StrandID    INTEGER NOT NULL REFERENCES Strand(StrandID)
);

CREATE TABLE IF NOT EXISTS Competency_Indicator (
  IndicatorID   INTEGER PRIMARY KEY AUTOINCREMENT,
  Description   TEXT NOT NULL,
  SubStrandID   INTEGER NOT NULL REFERENCES Sub_Strand(SubStrandID)
);

CREATE TABLE IF NOT EXISTS Competency_Records (
  RecordID          INTEGER PRIMARY KEY AUTOINCREMENT,
  RubricLevel       TEXT NOT NULL CHECK (RubricLevel IN ('Exceeds','Meets','Approaches','Below')),
  ObservationNotes  TEXT,
  LearnerID         INTEGER NOT NULL REFERENCES Learner(LearnerID),
  TeacherID         INTEGER NOT NULL REFERENCES Teacher(UserID),
  IndicatorID       INTEGER NOT NULL REFERENCES Competency_Indicator(IndicatorID),
  SyncStatus        TEXT NOT NULL DEFAULT 'pending' CHECK (SyncStatus IN ('pending','synced')),
  ClientUUID        TEXT UNIQUE,          -- id assigned offline, on the client, before sync
  CreatedAt         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Progress_Report (
  ReportID          INTEGER PRIMARY KEY AUTOINCREMENT,
  DateGenerated     TEXT NOT NULL DEFAULT (datetime('now')),
  AttainmentSummary TEXT NOT NULL,
  LearnerID         INTEGER NOT NULL REFERENCES Learner(LearnerID)
);

CREATE TABLE IF NOT EXISTS Sync_Log (
  LogID       INTEGER PRIMARY KEY AUTOINCREMENT,
  Status      TEXT NOT NULL,
  Timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
  TeacherID   INTEGER NOT NULL REFERENCES Teacher(UserID),
  RecordCount INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Learning_Resource (
  ResourceID   INTEGER PRIMARY KEY AUTOINCREMENT,
  Title        TEXT NOT NULL,
  FilePath     TEXT NOT NULL,
  SyncStatus   TEXT NOT NULL DEFAULT 'synced',
  TeacherID    INTEGER NOT NULL REFERENCES Teacher(UserID),
  SubStrandID  INTEGER NOT NULL REFERENCES Sub_Strand(SubStrandID)
);
