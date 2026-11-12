// 차시 자료 묶음. 1단원은 이 파일에, 2~5단원은 src/lessons/ 아래에 있다.
// 판 그림 글자와 걸음 종류는 lesson-engine.mjs 머리말을 본다.
//  .  빈 곳   X 흑   O 백   x/o 표시한 돌(문제의 대상)   * 정답 자리   + 활로 표시   ! 아님 표시   # 패 자리
// 걸음 종류
//  explain 설명만        free 자유롭게 놓기      explore 돌을 눌러 활로 보기
//  move    한 수 문제(check 조건으로 정답 자동 검산)
//  count   수 세기       choice 고르기           point 짚기(rule 또는 표시, need: one | all)
//  forbidden 둘 수 없는 자리에 두어 보기          sequence 정해진 수순 따라 두기
//  chase   단수를 쳐서 끝까지 몰아 잡기(상대가 알아서 받는다)
// 글은 한 걸음에 세 문장까지. 테스트(tests/lessons.test.mjs)가 모든 정답을 규칙 엔진으로 검산한다.
import { UNIT2, COUNT_MISSION } from './lessons/unit2.mjs';
import { UNIT3, QUIZ3 } from './lessons/unit3.mjs';
import { UNIT4, QUIZ4 } from './lessons/unit4.mjs';
import { UNIT5 } from './lessons/unit5.mjs';

export const UNITS = [
  { id: 1, title: '돌과 친해지기', topics: '활로, 따내기, 단수, 잇기와 끊기' },
  { id: 2, title: '꼭 알아야 할 규칙', topics: '둘 수 없는 곳, 패, 집, 한 판의 끝' },
  { id: 3, title: '삶과 죽음', topics: '두 집, 옥집, 급소, 빅' },
  { id: 4, title: '돌 잡는 기술', topics: '양단수, 축, 장문, 환격, 촉촉수, 수상전' },
  { id: 5, title: '한 판 두기', topics: '어디부터 둘까, 한 판의 흐름, 예절' },
];

// 단원 끝 미션. route 는 화면 주소.
export const MISSIONS = [
  { id: 'capture-go', unit: 1, title: '따내기 바둑', text: '한 점이라도 먼저 따내면 이겨요.', route: '#/capture' },
  { id: 'count-9', unit: 2, title: '집 세기', text: '끝난 판에서 죽은 돌을 골라내고 집을 세어요.', route: '#/count' },
  { id: 'Q3', unit: 3, title: '사활 10문제', text: '살리고 잡는 문제를 섞어서 풀어요.', route: '#/quiz/Q3' },
  { id: 'Q4', unit: 4, title: '기술 10문제', text: '돌 잡는 기술을 섞어서 풀어요.', route: '#/quiz/Q4' },
  { id: 'first-game', unit: 5, title: '첫 대국', text: '9줄 판에서 한 판을 끝까지 두고 집을 세어요.', route: '#/game' },
];

const EMPTY9 = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];

const UNIT1 = [
  {
    id: 'L01', unit: 1, no: 1, title: '바둑판과 돌',
    goal: '돌은 줄이 만나는 점에, 흑부터 번갈아 한 수씩 둔다는 것을 안다',
    steps: [
      {
        type: 'explain',
        text: '바둑은 검은 돌(흑)과 흰 돌(백)을 번갈아 놓는 놀이예요. 돌은 칸 안이 아니라 줄과 줄이 만나는 점에 놓아요.',
        board: { rows: ['.........', '.........', '.........', '....O....', '...X.....', '.....X...', '.........', '.........', '.........'] },
      },
      {
        type: 'free', count: 4,
        text: '판을 눌러 돌을 네 개 놓아 보세요. 흑이 먼저 두고, 그다음은 백 차례예요.',
        right: '잘 놓았어요! 흑, 백, 흑, 백. 이렇게 한 수씩 번갈아 두어요.',
        board: { rows: EMPTY9 },
      },
      {
        type: 'choice',
        text: '바둑에서 먼저 두는 쪽은 누구일까요?',
        choices: ['흑', '백'], answer: 0,
        right: '맞아요. 언제나 흑이 먼저 두어요.',
        wrong: '방금 어떤 색 돌이 먼저 놓였는지 떠올려 보세요.',
      },
      {
        type: 'explain',
        text: '판의 네 모서리 쪽을 귀, 가장자리를 변, 한가운데를 중앙이라고 해요.',
        board: {
          rows: EMPTY9,
          labels: [
            { at: 'C7', text: '귀' }, { at: 'G7', text: '귀' }, { at: 'C3', text: '귀' }, { at: 'G3', text: '귀' },
            { at: 'E8', text: '변' }, { at: 'E2', text: '변' }, { at: 'B5', text: '변' }, { at: 'H5', text: '변' },
            { at: 'E5', text: '중앙' },
          ],
        },
      },
      {
        type: 'point', rule: 'corner', need: 'one',
        text: '귀를 한 곳 눌러 보세요.',
        right: '맞아요, 거기가 귀예요. 귀는 모두 네 군데 있어요.',
        wrong: '거기는 귀가 아니에요. 판의 모서리 쪽을 눌러 보세요.',
        hint: '귀는 판의 네 모서리 쪽이에요.',
        board: { rows: EMPTY9 },
      },
      {
        type: 'point', rule: 'side', need: 'one',
        text: '이번에는 변을 한 곳 눌러 보세요.',
        right: '맞아요, 거기가 변이에요.',
        wrong: '거기는 변이 아니에요. 귀와 귀 사이의 가장자리를 눌러 보세요.',
        hint: '변은 귀와 귀 사이의 가장자리예요.',
        board: { rows: EMPTY9 },
      },
      {
        type: 'point', rule: 'center', need: 'one',
        text: '마지막으로 중앙을 눌러 보세요.',
        right: '맞아요, 판의 한가운데가 중앙이에요.',
        wrong: '거기는 중앙이 아니에요. 판의 한가운데를 눌러 보세요.',
        hint: '중앙은 판의 한가운데예요.',
        board: { rows: EMPTY9 },
      },
      {
        type: 'point', rule: 'star', need: 'one',
        text: '판 위의 굵은 점은 화점이에요. 자리를 찾기 쉽게 찍어 둔 표시예요. 화점을 한 곳 눌러 보세요.',
        right: '맞아요. 9줄 판에는 화점이 다섯 개 있어요.',
        wrong: '굵은 점이 찍힌 자리를 눌러 보세요.',
        hint: '굵은 점은 귀에 네 개, 한가운데에 한 개 있어요.',
        board: { rows: EMPTY9 },
      },
    ],
    summary: '돌은 줄이 만나는 점에 놓아요. 흑이 먼저, 한 수씩 번갈아 두어요.',
  },

  {
    id: 'L02', unit: 1, no: 2, title: '활로',
    goal: '돌 하나의 활로를 센다',
    steps: [
      {
        type: 'explain',
        text: '돌 바로 옆의 빈 점을 활로라고 해요. 돌이 숨을 쉬는 구멍이에요.',
        board: { rows: ['.....', '..+..', '.+X+.', '..+..', '.....'] },
      },
      {
        type: 'explain',
        text: '활로는 위, 아래, 왼쪽, 오른쪽 네 방향만 세요. 대각선은 활로가 아니에요.',
        board: { rows: ['.....', '.!+!.', '.+X+.', '.!+!.', '.....'] },
      },
      {
        type: 'explore', need: 3,
        text: '돌 세 개를 하나씩 눌러 보세요. 활로가 몇 개인지 알려 줄게요.',
        right: '가운데 돌은 4개, 변의 돌은 3개, 귀의 돌은 2개예요. 판 끝에서는 활로가 줄어들어요.',
        board: { rows: ['X....', '.....', '..X..', '.....', '..X..'] },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 4,
        text: '세모 표시한 돌의 활로는 몇 개일까요?',
        right: '맞아요. 가운데에 있는 돌의 활로는 4개예요.',
        board: { rows: ['.....', '.....', '..x..', '.....', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 3,
        text: '변에 있는 돌의 활로는 몇 개일까요?',
        right: '맞아요. 판 밖으로는 숨을 쉴 수 없어서 3개예요.',
        board: { rows: ['.....', '.....', '.....', '.....', '..x..'] },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 2,
        text: '귀에 있는 돌의 활로는 몇 개일까요?',
        right: '맞아요. 귀에 있는 돌의 활로는 2개뿐이에요.',
        board: { rows: ['x....', '.....', '.....', '.....', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 2,
        text: '옆에 백돌이 붙어 있어요. 세모 표시한 흑돌의 활로는 몇 개일까요?',
        right: '맞아요. 상대 돌이 놓인 자리는 활로가 아니에요.',
        board: { rows: ['.....', '..O..', '..xO.', '.....', '.....'] },
      },
    ],
    summary: '활로는 돌 바로 옆의 빈 점이에요. 가운데는 4개, 변은 3개, 귀는 2개예요.',
  },

  {
    id: 'L03', unit: 1, no: 3, title: '이어진 돌',
    goal: '이어진 돌은 활로를 함께 쓰고, 대각선은 이어진 것이 아니라는 것을 안다',
    steps: [
      {
        type: 'explain',
        text: '같은 색 돌이 줄을 따라 나란히 붙으면 한 덩어리가 돼요. 한 덩어리는 활로를 함께 써요.',
        board: { rows: ['.....', '.++..', '+XX+.', '.++..', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [4, 6, 8], answer: 6,
        text: '이어진 흑돌 두 점의 활로는 모두 몇 개일까요?',
        right: '맞아요. 두 점이 이어지면 활로가 6개예요.',
        board: { rows: ['.....', '.....', '.xx..', '.....', '.....'] },
      },
      {
        type: 'explain',
        text: '대각선으로 놓인 돌은 이어진 것이 아니에요. 줄을 따라 붙어야 이어진 거예요.',
        board: { rows: ['.....', '.X...', '..X..', '.....', '.....'] },
      },
      {
        type: 'choice', check: 'connected', yes: 0,
        text: '세모 표시한 두 돌은 이어져 있을까요?',
        choices: ['이어졌어요', '이어지지 않았어요'], answer: 1,
        right: '맞아요. 대각선으로 놓인 돌은 따로따로예요.',
        wrong: '두 돌 사이에 줄이 바로 닿아 있는지 살펴보세요.',
        board: { rows: ['.....', '.x...', '..x..', '.....', '.....'] },
      },
      {
        type: 'choice', check: 'connected', yes: 0,
        text: '이번에는 어떨까요? 세모 표시한 두 돌은 이어져 있을까요?',
        choices: ['이어졌어요', '이어지지 않았어요'], answer: 0,
        right: '맞아요. 가운데 돌을 거쳐서 세 점이 한 덩어리예요.',
        wrong: '가운데 돌이 두 돌을 이어 주고 있는지 살펴보세요.',
        board: { rows: ['.....', '..x..', '..X..', '..x..', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [6, 7, 8], answer: 8,
        text: '흑돌 세 점이 한 줄로 이어졌어요. 활로는 모두 몇 개일까요?',
        right: '맞아요. 돌이 이어질수록 활로가 많아져서 잡기 어려워져요.',
        board: { rows: ['.....', '.....', '.xxx.', '.....', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [6, 7, 8], answer: 7,
        text: '이번에는 꺾인 모양이에요. 흑돌 세 점의 활로는 모두 몇 개일까요?',
        right: '맞아요. 같은 세 점이라도 모양에 따라 활로 수가 달라져요.',
        board: { rows: ['.....', '.xx..', '..x..', '.....', '.....'] },
      },
      {
        type: 'count', check: 'liberties', choices: [4, 5, 6], answer: 5,
        text: '백돌이 한 점 붙어 있어요. 흑돌 두 점의 활로는 몇 개일까요?',
        right: '맞아요. 백돌이 활로 하나를 막아서 5개예요.',
        board: { rows: ['.....', '.O...', '.xx..', '.....', '.....'] },
      },
    ],
    summary: '나란히 붙은 같은 색 돌은 한 덩어리예요. 대각선은 이어진 것이 아니에요.',
  },

  {
    id: 'L04', unit: 1, no: 4, title: '따내기',
    goal: '상대 돌의 활로를 모두 막아 따낸다',
    steps: [
      {
        type: 'explain',
        text: '상대 돌의 활로를 모두 막으면 그 돌을 판에서 들어내요. 이것을 따내기라고 해요.',
        board: { rows: ['.....', '..X..', '.XO+.', '..X..', '.....'] },
      },
      {
        type: 'move', check: 'capture',
        text: '흑 차례예요. 백돌의 마지막 활로를 막아서 따내 보세요.',
        right: '따냈어요! 따낸 돌은 나중에 내 점수가 돼요.',
        wrong: '아쉬워요. 백돌의 활로가 아직 남아 있어요.',
        hint: '백돌 옆에 비어 있는 점은 한 곳뿐이에요.',
        board: { rows: ['.....', '..X..', '.XO*.', '..X..', '.....'] },
      },
      {
        type: 'move', check: 'capture',
        text: '변에 있는 백돌을 따내 보세요.',
        right: '잘했어요! 변에 있는 돌은 세 수면 잡혀요.',
        wrong: '아쉬워요. 백돌의 활로가 아직 남아 있어요.',
        hint: '변의 돌은 활로가 3개예요. 두 곳은 이미 막혀 있어요.',
        board: { rows: ['.....', '.....', '.....', '..*..', '.XOX.'] },
      },
      {
        type: 'move', check: 'capture',
        text: '귀에 있는 백돌을 따내 보세요.',
        right: '잘했어요! 귀에 있는 돌은 두 수면 잡혀요.',
        wrong: '아쉬워요. 백돌의 활로가 아직 남아 있어요.',
        hint: '귀의 돌은 활로가 2개예요. 한 곳은 이미 막혀 있어요.',
        board: { rows: ['.....', '.....', '.....', '*....', 'OX...'] },
      },
      {
        type: 'move', check: 'capture',
        text: '이어진 백돌 두 점을 한꺼번에 따내 보세요.',
        right: '두 점을 한꺼번에 따냈어요! 이어진 돌은 함께 잡혀요.',
        wrong: '아쉬워요. 백돌 덩어리의 활로가 아직 남아 있어요.',
        hint: '백돌 두 점 둘레에서 비어 있는 점을 찾아보세요.',
        board: { rows: ['.....', '..XX.', '.XOO*', '..XX.', '.....'] },
      },
      {
        type: 'move', check: 'capture',
        text: '백돌이 두 개 있어요. 지금 바로 따낼 수 있는 돌을 찾아 따내 보세요.',
        right: '잘 찾았어요! 활로가 하나 남은 돌을 따냈어요.',
        wrong: '아쉬워요. 그 수로는 아직 따낼 수 없어요.',
        hint: '활로가 하나만 남은 백돌이 어느 것인지 세어 보세요.',
        board: { rows: ['.......', '..X....', '.XO*...', '..X.O..', '.......', '.......', '.......'] },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 3, unit: '번',
        text: '세모 표시한 백돌을 따내려면 흑이 몇 번 더 두어야 할까요?',
        right: '맞아요. 남은 활로가 3개라서 세 번 더 두어야 해요.',
        board: { rows: ['.....', '..X..', '..o..', '.....', '.....'] },
      },
    ],
    summary: '상대 돌의 활로를 모두 막으면 따낼 수 있어요.',
  },

  {
    id: 'L05', unit: 1, no: 5, title: '단수',
    goal: '단수를 알아보고 단수를 친다',
    steps: [
      {
        type: 'explain',
        text: '활로가 하나만 남은 돌은 다음 수에 잡힐 수 있어요. 이런 상태를 단수라고 해요.',
        board: { rows: ['.....', '..X..', '.XO+.', '..X..', '.....'] },
      },
      {
        type: 'point', rule: 'atari', need: 'all',
        text: '백돌이 세 개 있어요. 단수가 된 돌을 찾아 눌러 보세요.',
        right: '잘 찾았어요! 이 백돌은 활로가 하나만 남았어요.',
        wrong: '그 돌은 활로가 넉넉해요. 흑돌에 둘러싸인 돌을 찾아보세요.',
        hint: '흑돌 세 개에 둘러싸인 백돌을 찾아보세요.',
        board: { rows: ['.......', '.O.....', '....X..', '...XOX.', '.......', '.O.X...', '.......'] },
      },
      {
        type: 'move', check: 'atari',
        text: '흑 차례예요. 세모 표시한 백돌을 단수로 만들어 보세요.',
        right: '단수예요! 다음에 한 번 더 두면 따낼 수 있어요.',
        wrong: '아쉬워요. 백돌의 활로를 하나만 남겨야 해요.',
        hint: '백돌의 활로는 지금 2개예요. 그중 하나를 막아 보세요.',
        board: { rows: ['.....', '..X..', '.Xo*.', '..*..', '.....'] },
      },
      {
        type: 'move', check: 'atari',
        text: '변에 있는 백돌도 단수로 만들어 보세요.',
        right: '단수예요! 변에서는 돌을 잡기가 더 쉬워요.',
        wrong: '아쉬워요. 백돌의 활로를 하나만 남겨야 해요.',
        hint: '백돌의 활로는 지금 2개예요. 그중 하나를 막아 보세요.',
        board: { rows: ['.....', '.....', '.....', '.*...', 'Xo*..'] },
      },
      {
        type: 'move', check: 'capture',
        text: '백돌이 단수예요. 놓치지 말고 따내 보세요.',
        right: '따냈어요! 단수를 알아보면 돌을 잡을 수 있어요.',
        wrong: '아쉬워요. 백돌의 마지막 활로를 막아야 해요.',
        hint: '백돌 옆에 비어 있는 점은 한 곳뿐이에요.',
        board: { rows: ['.....', '.X...', 'XO*..', '.X...', '.....'] },
      },
      {
        type: 'choice',
        text: '이번에는 흑돌이 단수예요. 지금이 백 차례라면 어떻게 될까요?',
        choices: ['흑돌이 잡힐 수 있어요', '아무 일도 없어요'], answer: 0,
        right: '맞아요. 그래서 내 돌이 단수인지 늘 살펴봐야 해요.',
        wrong: '백이 초록 점 자리에 두면 어떻게 될지 생각해 보세요.',
        board: { rows: ['.....', '..O..', '.OX+.', '..O..', '.....'] },
      },
      {
        type: 'point', rule: 'atari', need: 'all',
        text: '단수가 된 돌이 두 군데 있어요. 흑돌과 백돌을 모두 살펴서 찾아 눌러 보세요.',
        right: '모두 찾았어요! 내 돌과 상대 돌을 함께 살피는 눈이 생겼어요.',
        wrong: '그 돌은 활로가 2개 이상이에요. 다시 세어 보세요.',
        hint: '하나는 귀에 있는 흑돌이고, 하나는 이어진 백돌 두 점이에요.',
        board: { rows: ['XO.....', '.......', '.......', '..XX...', '.XOO...', '..XX...', '.......'] },
      },
    ],
    summary: '활로가 하나 남으면 단수예요. 단수가 된 돌은 다음 수에 잡힐 수 있어요.',
  },

  {
    id: 'L06', unit: 1, no: 6, title: '달아나기와 잇기',
    goal: '단수가 된 내 돌을 살린다',
    steps: [
      {
        type: 'explain',
        text: '내 돌이 단수가 되면 달아나야 해요. 남은 활로 쪽으로 한 칸 뻗으면 활로가 늘어나요.',
        board: { rows: ['.....', '..O..', '.OX+.', '..O..', '.....'] },
      },
      {
        type: 'move', check: 'escape',
        text: '세모 표시한 흑돌이 단수예요. 한 칸 뻗어서 달아나 보세요.',
        right: '달아났어요! 활로가 1개에서 3개로 늘었어요.',
        wrong: '아쉬워요. 흑돌이 아직 단수예요.',
        hint: '흑돌의 하나 남은 활로 자리에 두어 보세요.',
        board: { rows: ['.....', '..O..', '.Ox*.', '..O..', '.....'] },
      },
      {
        type: 'explain',
        text: '가까이에 내 돌이 있으면 이어서 살 수도 있어요. 이으면 활로를 함께 쓰니까요.',
        board: { rows: ['.....', '..O..', '.OX+X', '..O..', '.....'] },
      },
      {
        type: 'move', check: 'escape',
        text: '세모 표시한 흑돌을 옆에 있는 흑돌과 이어서 살려 보세요.',
        right: '이었어요! 세 점이 한 덩어리가 되어 활로가 4개예요.',
        wrong: '아쉬워요. 흑돌이 아직 단수예요.',
        hint: '두 흑돌 사이의 빈 점에 두어 보세요.',
        board: { rows: ['.....', '..O..', '.Ox*X', '..O..', '.....'] },
      },
      {
        type: 'move', check: 'capture',
        text: '흑돌이 단수인데, 단수 친 백돌 하나도 단수예요. 그 백돌을 먼저 따내서 살아 보세요.',
        right: '멋져요! 상대 돌을 따내니 내 돌의 활로도 늘었어요.',
        wrong: '아쉬워요. 단수가 된 백돌의 마지막 활로를 찾아보세요.',
        hint: '흑돌 두 개에 막혀 있는 백돌을 찾아보세요.',
        board: { rows: ['.....', '..OX.', '.OxOX', '...*.', '.....'] },
      },
      {
        type: 'move', check: 'escape',
        text: '조금 넓은 판이에요. 세모 표시한 흑돌을 살려 보세요.',
        right: '잘했어요! 내 돌이 있는 쪽으로 달아나면 더 튼튼해요.',
        wrong: '아쉬워요. 흑돌이 아직 단수예요.',
        hint: '흑돌의 하나 남은 활로가 어디인지 찾아보세요.',
        board: { rows: ['.......', '..O....', '.Ox*...', '..O.X..', '.......', '.......', '.......'] },
      },
      {
        type: 'choice',
        text: '단수가 된 내 돌을 살리는 방법이 아닌 것은 무엇일까요?',
        choices: ['남은 활로 쪽으로 뻗기', '옆의 내 돌과 잇기', '멀리 다른 곳에 두기'], answer: 2,
        right: '맞아요. 다른 곳에 두면 상대가 바로 따내 버려요.',
        wrong: '그건 돌을 살리는 방법이에요. 살릴 수 없는 것을 골라 보세요.',
      },
    ],
    summary: '단수가 되면 뻗거나, 내 돌과 잇거나, 상대 돌을 먼저 따내요.',
  },

  {
    id: 'L07', unit: 1, no: 7, title: '끊기',
    goal: '상대 돌을 끊고, 내 돌은 끊기지 않게 잇는다',
    steps: [
      {
        type: 'explain',
        text: '대각선으로 놓인 돌은 아직 이어진 게 아니에요. 그 사이를 상대가 막으면 둘로 갈라져요. 이것을 끊기라고 해요.',
        board: { rows: ['.....', '.....', '..OX.', '..+O.', '.....'] },
      },
      {
        type: 'move', check: 'cut',
        text: '흑 차례예요. 세모 표시한 백돌 두 점 사이를 끊어 보세요.',
        right: '끊었어요! 백돌이 둘로 갈라져서 약해졌어요.',
        wrong: '아쉬워요. 그 자리로는 백돌이 갈라지지 않아요.',
        hint: '백이 두면 두 돌이 이어지는 자리가 어디일까요? 그 자리를 먼저 차지해 보세요.',
        board: { rows: ['.....', '.....', '..oX.', '..*o.', '.....'] },
      },
      {
        type: 'explain',
        text: '반대로 내 돌이 끊길 것 같으면 내가 먼저 그 자리에 두어서 이어요.',
        board: { rows: ['.....', '.....', '..XO.', '..+X.', '.....'] },
      },
      {
        type: 'move', check: 'connect',
        text: '세모 표시한 흑돌 두 점이 끊기지 않게 이어 보세요.',
        right: '이었어요! 이제 두 돌은 한 덩어리예요.',
        wrong: '아쉬워요. 두 돌이 아직 이어지지 않았어요.',
        hint: '두 흑돌에 모두 닿는 빈 점을 찾아보세요.',
        board: { rows: ['.....', '.....', '..xO.', '..*x.', '.....'] },
      },
      {
        type: 'move', check: 'cut',
        text: '조금 넓은 판이에요. 세모 표시한 백돌들 사이를 끊어 보세요.',
        right: '끊었어요! 백돌이 두 덩어리로 갈라졌어요.',
        wrong: '아쉬워요. 그 자리로는 백돌이 갈라지지 않아요.',
        hint: '백돌 두 덩어리에 모두 닿는 빈 점을 찾아보세요.',
        board: { rows: ['.......', '.......', '..XoO..', '.Oo*...', '.......', '.......', '.......'] },
      },
      {
        type: 'move', check: 'connect',
        text: '이번에는 흑돌 차례예요. 세모 표시한 흑돌들이 끊기지 않게 이어 보세요.',
        right: '이었어요! 네 점이 한 덩어리가 되어 튼튼해졌어요.',
        wrong: '아쉬워요. 두 덩어리가 아직 이어지지 않았어요.',
        hint: '흑돌 두 덩어리에 모두 닿는 빈 점을 찾아보세요.',
        board: { rows: ['.......', '.......', '..OxX..', '.Xx*...', '.......', '.......', '.......'] },
      },
      {
        type: 'choice',
        text: '돌이 이어져 있으면 무엇이 좋을까요?',
        choices: ['활로를 함께 써서 잡히기 어려워요', '돌이 더 빨리 놓여요'], answer: 0,
        right: '맞아요. 그래서 내 돌은 잇고 상대 돌은 끊는 거예요.',
        wrong: '이어진 돌의 활로가 어떻게 되는지 떠올려 보세요.',
      },
    ],
    summary: '상대 돌 사이를 막으면 끊기, 내가 먼저 두면 잇기예요.',
  },
];

export const LESSONS = [...UNIT1, ...UNIT2, ...UNIT3, ...UNIT4, ...UNIT5];
export const QUIZZES = [QUIZ3, QUIZ4];
export const COUNT_BOARD = COUNT_MISSION;

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) || null;
}

export function quizById(id) {
  return QUIZZES.find((q) => q.id === id) || null;
}

export function lessonsOfUnit(unitId) {
  return LESSONS.filter((l) => l.unit === unitId);
}

export function missionOfUnit(unitId) {
  return MISSIONS.find((m) => m.unit === unitId) || null;
}
