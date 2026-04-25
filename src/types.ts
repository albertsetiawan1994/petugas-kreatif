export const ALL_ROLES = [
  'OBS',
  'SOUND',
  'CAM 1',
  'CAM 2',
  'FOTO',
];

export interface Volunteer {
  id: string;
  name: string;
  roles: string[];
  phone?: string;
  isUnavailable?: boolean;
  excludeFromAutoFill?: boolean;
}

export type Role = string;

export interface MassEvent {
  id: string;
  name: string;
  number: number;
  date: string;
  time: string;
  needsOBS: boolean;
  needsSound: boolean;
  needsCam1: boolean;
  needsPhoto: boolean;
  isBigMass: boolean;
  allowDuplicate?: boolean; // New field to persist exception
}

export interface ScheduleAssignment {
  id?: string;
  eventId: string;
  obs?: string;
  sound?: string;
  cam1?: string;
  cam2?: string;
  foto?: string;
}

export interface CombinedScheduleRow {
  event: MassEvent;
  assignment: ScheduleAssignment;
}

export interface Unavailable {
    id: string;
    volunteerId: string;
    volunteerName: string;
    date: string; // YYYY-MM-DD
}

export interface Schedule {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    title?: string;
    eventName: string;
    assignments: {
        [role: string]: string; // role -> volunteerId
    }
}
