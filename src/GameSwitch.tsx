import { LOTTERY_GAMES } from "./domain";
import type { LotteryGame } from "./domain";
import { useI18n } from "./i18n";
import { useLotteryStore } from "./store";

export default function GameSwitch(){
  const {t}=useI18n();
  const {selectedGame,setSelectedGame}=useLotteryStore();
  return <div className="game-switch" role="group" aria-label={t("game.selector")}>
    {(Object.keys(LOTTERY_GAMES) as LotteryGame[]).map(game=><button type="button" key={game} className={selectedGame===game?"active":""} aria-pressed={selectedGame===game} onClick={()=>setSelectedGame(game)}>{LOTTERY_GAMES[game].name}</button>)}
  </div>;
}
