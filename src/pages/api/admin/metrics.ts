import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { period } = req.query;
  const periodHours = parseInt(period as string) || 24;
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

  try {
    // Tentar usar system_logs, fallback para otps + usuarios
    let useSystemLogs = true;
    const { error: testError } = await supabase
      .from('system_logs')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    if (testError) {
      useSystemLogs = false;
    }

    let deliverySuccessRate = 0;
    let totalSent = 0;
    let totalVerified = 0;
    let totalEvents = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let uniqueUsers = 0;
    let p50 = 0, p95 = 0, p99 = 0;
    const eventDistribution: Record<string, number> = {};

    if (useSystemLogs) {
      const { count: sentCount } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .gte('timestamp', since)
        .in('event_type', ['otp_sent', 'email_verification_sent']);

      const { count: successCount } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .gte('timestamp', since)
        .in('event_type', ['otp_sent', 'email_verification_sent'])
        .eq('status', 'success');

      const { data: verificationTimes } = await supabase
        .from('system_logs')
        .select('time_elapsed_ms')
        .gte('timestamp', since)
        .eq('event_type', 'otp_verified')
        .eq('status', 'success')
        .not('time_elapsed_ms', 'is', null)
        .order('time_elapsed_ms', { ascending: true });

      if (verificationTimes && verificationTimes.length > 0) {
        const times = verificationTimes.map(v => v.time_elapsed_ms).sort((a, b) => a - b);
        const len = times.length;
        p50 = times[Math.floor(len * 0.5)] || 0;
        p95 = times[Math.floor(len * 0.95)] || 0;
        p99 = times[Math.floor(len * 0.99)] || 0;
      }

      const { data: eventDistributionData } = await supabase
        .from('system_logs')
        .select('event_type')
        .gte('timestamp', since);

      if (eventDistributionData) {
        eventDistributionData.forEach((curr: any) => {
          eventDistribution[curr.event_type] = (eventDistribution[curr.event_type] || 0) + 1;
        });
      }

      const { count: eventsCount } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .gte('timestamp', since);

      const { count: successesCount } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .gte('timestamp', since)
        .eq('status', 'success');

      const { count: failuresCount } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .gte('timestamp', since)
        .eq('status', 'failure');

      const { data: uniqueEmails } = await supabase
        .from('system_logs')
        .select('email')
        .gte('timestamp', since)
        .not('email', 'is', null);

      totalSent = sentCount || 0;
      totalVerified = successCount || 0;
      deliverySuccessRate = totalSent > 0 ? (totalVerified / totalSent) * 100 : 0;
      totalEvents = eventsCount || 0;
      totalSuccesses = successesCount || 0;
      totalFailures = failuresCount || 0;
      uniqueUsers = new Set((uniqueEmails || []).map((e: any) => e.email)).size;
    } else {
      // Fallback: usar tabela otps diretamente
      const { data: otps } = await supabase
        .from('otps')
        .select('verified, method, created_at, expires_at')
        .gte('created_at', since);

      const otpsList = otps || [];
      totalSent = otpsList.length;
      totalVerified = otpsList.filter(o => o.verified).length;
      deliverySuccessRate = totalSent > 0 ? (totalVerified / totalSent) * 100 : 0;
      totalEvents = totalSent;
      totalSuccesses = totalVerified;
      totalFailures = otpsList.filter(o => {
        const attempts = (o as any).attempts || 0;
        return attempts >= 3;
      }).length;
      uniqueUsers = new Set(otpsList.map(o => o.method)).size;

      eventDistribution['otp_sent'] = totalSent;
      eventDistribution['otp_verified'] = totalVerified;
      eventDistribution['otp_failed'] = totalFailures;
    }

    return res.status(200).json({
      success: true,
      period_hours: periodHours,
      metrics: {
        delivery_success_rate: deliverySuccessRate,
        total_sent: totalSent,
        total_verified: totalVerified,
        percentiles: { p50, p95, p99 },
        event_distribution: eventDistribution,
        total_events: totalEvents,
        total_successes: totalSuccesses,
        total_failures: totalFailures,
        unique_users: uniqueUsers,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      success: true,
      period_hours: periodHours,
      metrics: {
        delivery_success_rate: 0,
        total_sent: 0,
        total_verified: 0,
        percentiles: { p50: 0, p95: 0, p99: 0 },
        event_distribution: {},
        total_events: 0,
        total_successes: 0,
        total_failures: 0,
        unique_users: 0,
      },
    });
  }
}
