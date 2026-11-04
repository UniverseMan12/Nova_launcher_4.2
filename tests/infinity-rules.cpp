#include "InfinityRules.h"
#include "DeathCreditRules.h"
#include <cassert>
#include <iostream>
#include <set>
int main() {
    using namespace InfinityRules;
    DeathCreditRules::HandledDeaths credits, otherPlayer;
    const uint64_t firstLife = (uint64_t(12) << 32) | 42;
    const uint64_t reusedSlot = (uint64_t(13) << 32) | 42;
    assert(!credits.Claim(0));
    assert(credits.Claim(firstLife));
    assert(!credits.Claim(firstLife)); // repeated death callback cannot credit twice
    assert(credits.Claim(reusedSlot)); // same UObject slot, new serial/life
    assert(!credits.Claim(firstLife)); // delayed old-life duplicate after a new life
    assert(otherPlayer.Claim(firstLife)); // independent player/session ledgers
    credits = {};
    assert(credits.Claim(firstLife)); // new session clears the previous claims
    Landing landing;
    assert(!landing.Ready(1, false, 100)); // Skydiving must not start the timer.
    assert(!landing.Ready(1, true, 140));
    assert(!landing.Ready(1, true, 159.99));
    assert(!landing.Ready(1, false, 160)); // No midair transformation after a jump.
    assert(landing.Ready(1, true, 161)); // Jumping does not reset the first landing.
    assert(!landing.Ready(2, true, 180)); // New pawn/life gets a fresh delay.
    assert(landing.Ready(2, true, 200));
    assert(BusSpeed > 0 && BusDropStart < BusDropEnd && BusDropEnd < BusFlightEnd);
    assert((BusDropEnd - BusDropStart) * BusSpeed < ArenaRadius * 2);
    assert(!CanLeaveBus(false, true, true, 5));
    assert(!CanLeaveBus(true, false, true, 5)); // No exit into an uninitialized arena.
    assert(!CanLeaveBus(true, true, false, 5)); // Repeated RPC after exiting.
    assert(!CanLeaveBus(true, true, true, -1));
    assert(!CanLeaveBus(true, true, true, BusDropStart - .01));
    assert(CanLeaveBus(true, true, true, BusDropStart));
    assert(CanLeaveBus(true, true, true, BusDropEnd));
    assert(CanLeaveBus(true, true, true, BusFlightEnd)); // Forced native ejection.
    assert(!CanLeaveBus(true, true, true, NAN));
    ZoneLifecycle zone;
    assert(!zone.Initialize(false, false)); // Never advance without an indicator.
    assert(zone.Initialize(false, true)); // Aircraft preview.
    assert(!zone.Initialize(false, true)); // No repeated storm alerts.
    assert(!zone.Initialize(true, false));
    assert(zone.Initialize(true, true)); // Complete initialization after the bus.
    assert(!zone.Initialize(true, true));
    assert(!zone.Initialize(false, true)); // Do not return to preview.
    FixedArena arena;
    assert(arena.Capture(10000) == 15000);
    assert(arena.Capture(15000) == 15000); // Repairs must not grow the arena.
    assert(arena.Capture(80000) == 15000); // Native post-bus reset is ignored.
    assert(LargerArena(20000) == 27000);
    assert(LargerArena(8000) == 15000);
    assert(LargerArena(-1) == 15000);
    Lives a,b;
    assert(a.Die(100) == Lives::Respawn);
    assert(a.remaining == 9 && a.pending);
    assert(a.Die(100) == Lives::Duplicate && a.remaining == 9);
    assert(a.Die(101) == Lives::Duplicate && a.remaining == 9); // retry must not spend another life
    assert(b.remaining == 10); // player budgets are independent
    a.Spawned();
    assert(a.Die(100) == Lives::Duplicate); // late notification from old pawn
    for(uint64_t i=101;i<=109;++i) {assert(a.Die(i)==Lives::Respawn);a.Spawned();}
    assert(a.remaining==0 && !a.eliminated); // tenth respawn is playable
    assert(a.Die(110)==Lives::Eliminate && a.eliminated);
    assert(a.Die(110)==Lives::Duplicate && a.remaining==0);
    assert(b.Die(200)==Lives::Respawn && b.remaining==9);
    b.Disconnect(); assert(b.eliminated && !b.pending && b.remaining==9);
    std::mt19937 random(42); std::set<std::string> selected;
    Selection selection;
    assert(selection.Choose({"a"},random,0)=="a"); // First selection has only the landing delay.
    selection.Wait(200); // Thanos dies while other players are already eligible.
    assert(landing.Ready(2,true,200));
    assert(selection.Choose({"killer","previous","survivor"},random,200).empty());
    assert(selection.Choose({"killer","previous","survivor"},random,219.99).empty());
    auto untouchedRandom = random;
    assert(selection.Choose({"killer"},random,210).empty());
    assert(random == untouchedRandom); // Waiting must not secretly roll a winner.
    for(int i=0;i<1000;++i) {
        auto chosen=selection.Choose({"killer","previous","survivor"},random,220);
        assert(!chosen.empty()); selected.insert(chosen);
    }
    assert(selected==std::set<std::string>({"killer","previous","survivor"}));
    assert(selection.Choose({},random,220).empty());
    assert(selection.Choose({"previous"},random,220)=="previous"); // Solo / only ready player.
    selection.Wait(250); // Every subsequent loss starts a fresh 20 seconds.
    assert(selection.Choose({"killer"},random,269.99).empty());
    assert(selection.Choose({},random,270).empty());
    assert(selection.Choose({"killer"},random,275)=="killer"); // An empty pool does not restart the timer.
    selection = {}; // A new world must not inherit the previous match's cooldown.
    assert(selection.Choose({"a"},random,0)=="a");
    std::cout << "PASS: once-per-life kill credit, landing and reselection delays, all eligible players in random pool, airborne exclusion, new-life delay, bus timing, 10 respawns, independent budgets, duplicate deaths, failed-spawn retries and disconnect forfeits.\n";
}
