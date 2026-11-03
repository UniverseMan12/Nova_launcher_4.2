# NOVA DROP 0.4.4 — gameplay correction test

**Test build, not a published release.** This build addresses the owner's failed 0.4.3 playtest. Its in-game results still need confirmation.

- Auto-Sprint keeps Fortnite 4.2's native ability activation and input-release lifecycle. Test repeated W press/release, walking and gliding.
- Character parts use the correct fixed 4.2 layout, with compatible gender and body size chosen before the appearance is refreshed.
- The local player reads the outfit, glider, pickaxe, backpack, contrail and emotes saved by the lobby. A remote friend is never given the host's saved outfit; remote cosmetic delivery is still unconfirmed.
- Full reset retains the normal-appearance snapshot and reapplies the selected outfit to the new pawn.
- Clear inventory, practice respawn, the larger text, grouped Thanos picker and update changelog are retained.

## Testing

Close the previous launcher/game, open the separate 0.4.4 test launcher and use Classic / Solo. Select Black Knight and the Lightning glider again. Check W start/stop, body proportions, gliding jitter and Full reset after becoming Thanos.

The native server build and appearance-rule checks passed. Detailed build hashes and the pending gameplay checks are in RELEASE_QA.md. The public 0.4.3 notes disclose its reported bugs; 0.4.2 is temporarily the automatic-update target.
