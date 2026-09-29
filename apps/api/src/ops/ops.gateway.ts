import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

@WebSocketGateway({ namespace: 'ops', cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' } })
export class OpsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private timer?: NodeJS.Timeout;
  private tick = 0;

  afterInit() {
    this.timer = setInterval(() => {
      this.tick += 1;
      this.server.emit('ops.tick', {
        label: 'SIMULATED / NOT ROVER TELEMETRY',
        sequence: this.tick,
        time: new Date().toISOString(),
        phase: ['Traverse concept staged', 'Science context reviewed', 'Evidence pipeline ready'][this.tick % 3],
      });
    }, 3000);
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
