import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import { BlockList, isIP } from 'net';

const EDGE_KEY_HEADER = 'x-paribelle-edge-key';
const CLIENT_IP_HEADER = 'x-paribelle-client-ip';

const digest = (s: string) => createHash('sha256').update(s).digest();

const privateRanges = new BlockList();
privateRanges.addSubnet('10.0.0.0', 8, 'ipv4');
privateRanges.addSubnet('172.16.0.0', 12, 'ipv4');
privateRanges.addSubnet('192.168.0.0', 16, 'ipv4');
privateRanges.addSubnet('127.0.0.0', 8, 'ipv4');
privateRanges.addAddress('::1', 'ipv6');
privateRanges.addSubnet('fc00::', 7, 'ipv6');
privateRanges.addSubnet('fe80::', 10, 'ipv6');

function isPrivate(ip: string | undefined): boolean {
  if (!ip) return false;
  const bare = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const family = isIP(bare);
  return family !== 0 && privateRanges.check(bare, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Rate limits per visitor rather than per connection.
 *
 * The edge Workers relay every request (to the ThinkPad or to Render), so the address
 * the API sees is theirs. They send the visitor's address in X-Paribelle-Client-IP along
 * with the shared EDGE_KEY; with a matching key, that address is the one limited.
 * Without the key the header is ignored, so nobody can pick their own bucket.
 *
 * THROTTLE_SKIP_PRIVATE=true (the ThinkPad only) leaves keyless requests from a private
 * address alone: there, those can only be the storefront's own server-side calls.
 */
@Injectable()
export class EdgeThrottlerGuard extends ThrottlerGuard {
  private readonly edgeKey = process.env.EDGE_KEY ? digest(process.env.EDGE_KEY) : null;
  private readonly skipPrivate = process.env.THROTTLE_SKIP_PRIVATE === 'true';

  private fromEdge(req: Record<string, any>): boolean {
    const sent = req.headers?.[EDGE_KEY_HEADER];
    return !!this.edgeKey && typeof sent === 'string' && timingSafeEqual(digest(sent), this.edgeKey);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const visitor = req.headers?.[CLIENT_IP_HEADER];
    if (typeof visitor === 'string' && visitor && this.fromEdge(req)) return visitor;
    return req.ip;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (await super.shouldSkip(context)) return true;
    if (!this.skipPrivate || context.getType() !== 'http') return false;
    const req = context.switchToHttp().getRequest();
    return isPrivate(req.ip) && !this.fromEdge(req);
  }
}
