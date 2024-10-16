declare module 'smpp' {
  export class Session {
    constructor(options: { host: string; port: number });

    on(event: string, callback: (...args: any[]) => void): void;
    bind_transceiver(options: any, callback: (pdu: any) => void): void;
    submit_sm(options: any, callback: (pdu: any) => void): void;
    close(): void;
    connect(): void;
  }
}