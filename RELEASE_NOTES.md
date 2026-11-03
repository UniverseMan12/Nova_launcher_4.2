# NOVA DROP 0.4.4 — gameplay correction test

**Second test candidate, not a published release.** The first 0.4.4 playtest still had movement errors. The HUD-scale Apply crash remains unresolved.

- Auto-Sprint now separates the movement and sprint inputs instead of binding both actions to W. Test repeated W press/release, walking, gliding and returning from menus or another window. In-game behavior needs confirmation.
- Character parts use the correct fixed 4.2 layout, with compatible gender and body size chosen before the appearance is refreshed.
- The local player reads the outfit, glider, pickaxe, backpack, contrail and emotes saved by the lobby. A remote friend is never given the host's saved outfit; remote cosmetic delivery is still unconfirmed.
- Full reset retains the normal-appearance snapshot and reapplies the selected outfit to the new pawn.
- Clear inventory, practice respawn, the larger text, grouped Thanos picker and update changelog are retained.

## Testing

Close the previous launcher/game, open the separately named Sprint test launcher and use Classic / Solo. Enable Auto-Sprint. Check W start/stop several times, gliding, and releasing/repressing W after a window switch. Black Knight and Cloud Strike appeared in the owner's first video; repeated Full reset and remote cosmetics still need confirmation. Test HUD Scale / Apply separately with Auto-Sprint off to narrow down its crash.

The native server build and appearance-rule checks passed. Detailed build hashes and the pending gameplay checks are in RELEASE_QA.md. The public 0.4.3 notes disclose its reported bugs; 0.4.2 is temporarily the automatic-update target.
