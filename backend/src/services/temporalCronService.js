const StatuteNode = require('../models/StatuteNode');

class TemporalCronService {
  
  async syncTemporalRules() {
    console.log('[TemporalCron] Initiating daily temporal drift sweep...');
    const now = new Date();
    
    // Example Rule 1: The BNS/IPC Transition (July 1, 2024)
    const bnsEffectiveDate = new Date('2024-07-01T00:00:00Z');
    
    if (now >= bnsEffectiveDate) {
      console.log('[TemporalCron] BNS Transition Date Reached. Sweeping legacy criminal codes...');
      
      // Mark IPC, CrPC, Evidence Act as Repealed using actName
      const repealResult = await StatuteNode.updateMany(
        { 
          actName: { $regex: /Indian Penal Code|Code of Criminal Procedure|Indian Evidence Act/i }, 
          isRepealed: false 
        },
        { 
          $set: { 
            isRepealed: true, 
            repealedBy: 'BNS/BNSS/BSA',
            amendedDate: now
          } 
        }
      );
      
      if (repealResult.modifiedCount > 0) {
        console.log(`[TemporalCron] ✅ Successfully repealed ${repealResult.modifiedCount} legacy statutes.`);
      } else {
        console.log('[TemporalCron] ⚡ Legacy criminal codes already marked as repealed.');
      }
    }

    // You can add more sweeps here (e.g., activating future effective dates)
    // const activationResult = await StatuteNode.updateMany( { effectiveDate: { $lte: now }, isActive: false }, ... );

    console.log('[TemporalCron] Temporal sweep complete.');
  }
}

module.exports = new TemporalCronService();
