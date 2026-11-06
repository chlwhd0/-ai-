export interface Registration {
  id: string;
  phone: string;
  phoneDigits: string;
  os: 'Android' | 'iOS';
  server: string;
  serverName: string;
  ch: number;
  mkt: boolean;
  coupon: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServerInfo {
  id: string;
  name: string;
  desc: string;
  tag: [string, string];
  base: number[];
  cap: number[];
}

export interface Milestone {
  g: number;
  r: string;
}
