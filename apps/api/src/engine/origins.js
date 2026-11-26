// The 27 oblast centres a user can say they move from (ProfileAnswers.current_location = EKATTE).
// Every pilot settlement has an OSRM drive time to each of them (drive_to_oblast_centres), so an
// origin here gives an exact drive time. Any of the 90 pilot settlements is also accepted as an
// origin; then the drive time goes through its oblast centre and is marked "estimated".
export const ORIGINS = [
  ["04279", "Благоевград"], ["07079", "Бургас"], ["10135", "Варна"], ["10447", "Велико Търново"],
  ["10971", "Видин"], ["12259", "Враца"], ["14218", "Габрово"], ["72624", "Добрич"],
  ["40909", "Кърджали"], ["41112", "Кюстендил"], ["43952", "Ловеч"], ["48489", "Монтана"],
  ["55155", "Пазарджик"], ["55871", "Перник"], ["56722", "Плевен"], ["56784", "Пловдив"],
  ["61710", "Разград"], ["63427", "Русе"], ["66425", "Силистра"], ["67338", "Сливен"],
  ["67653", "Смолян"], ["68134", "София"], ["68850", "Стара Загора"], ["73626", "Търговище"],
  ["77195", "Хасково"], ["83510", "Шумен"], ["87374", "Ямбол"],
].map(([ekatte, name]) => ({ ekatte, name }));
