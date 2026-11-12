// 2단원. 꼭 알아야 할 규칙 (8~11차시)
import { fill } from './tools.mjs';

const U2_WALL5 = ['..XO.', '..XO.', '..XO.', '..XO.', '..XO.'];
const U2_CORNERS = ['...X...', '...X...', 'XXXX...', '.......', '....OOO', '....O..', '....O..'];

export const UNIT2 = [
  {
    id: 'L08', unit: 2, no: 8, title: '둘 수 없는 곳',
    goal: '착수금지 자리와, 따낼 수 있어서 둘 수 있는 자리를 구별한다',
    steps: [
      {
        type: 'explain',
        text: '돌을 놓자마자 활로가 하나도 없는 자리에는 둘 수 없어요. 이런 곳을 착수금지라고 해요.',
        board: { rows: ['.....', '..X..', '.X!X.', '..X..', '.....'] },
      },
      {
        type: 'forbidden', reason: 'suicide',
        text: '이번에는 백 차례예요. 동그라미 자리에 백돌을 두어 보세요.',
        right: '둘 수 없어요! 놓자마자 사방이 흑돌이라 활로가 없기 때문이에요.',
        board: { rows: ['.....', '..X..', '.X*X.', '..X..', '.....'], turn: 'W' },
      },
      {
        type: 'explain',
        text: '하지만 그 수로 상대 돌을 따낼 수 있으면 둘 수 있어요. 따내고 나면 활로가 생기니까요.',
        board: { rows: ['+XO..', 'XO...', 'O....', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'move', check: 'capture',
        text: '백 차례예요. 귀의 빈 자리에 두어서 흑돌 두 점을 따내 보세요.',
        right: '따냈어요! 활로가 없는 자리였지만 따낼 수 있어서 둘 수 있었어요.',
        wrong: '아쉬워요. 흑돌 두 점의 마지막 활로를 찾아보세요.',
        hint: '귀의 맨 구석 자리를 보세요.',
        board: { rows: ['*XO..', 'XO...', 'O....', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'choice', check: 'legal', yes: 0,
        text: '백 차례예요. 백은 동그라미 자리에 둘 수 있을까요?',
        choices: ['둘 수 있어요', '둘 수 없어요'], answer: 1,
        right: '맞아요. 따낼 흑돌이 없으니 착수금지예요.',
        wrong: '그 자리에 두면 따낼 수 있는 흑돌이 있는지 살펴보세요.',
        board: { rows: ['.X...', 'X*X..', '.X...', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'choice', check: 'legal', yes: 0,
        text: '같은 자리예요. 이번에는 흑 차례라면 흑은 둘 수 있을까요?',
        choices: ['둘 수 있어요', '둘 수 없어요'], answer: 0,
        right: '맞아요. 자기 돌과 이어져서 활로가 생기니까 둘 수 있어요.',
        wrong: '흑돌을 놓으면 둘레의 흑돌과 이어진다는 것을 떠올려 보세요.',
        board: { rows: ['.X...', 'X*X..', '.X...', '.....', '.....'] },
      },
      {
        type: 'choice', check: 'legal', yes: 0,
        text: '다시 백 차례예요. 이번에는 백이 동그라미 자리에 둘 수 있을까요?',
        choices: ['둘 수 있어요', '둘 수 없어요'], answer: 0,
        right: '맞아요. 오른쪽 흑돌 한 점을 따낼 수 있어서 둘 수 있어요.',
        wrong: '동그라미 오른쪽 흑돌의 활로를 세어 보세요.',
        board: { rows: ['.XO..', 'X*XO.', '.XO..', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'point', rule: 'illegal', need: 'all',
        text: '백 차례예요. 백이 둘 수 없는 곳이 두 군데 있어요. 모두 찾아 눌러 보세요.',
        right: '모두 찾았어요! 흑돌에 빈틈없이 둘러싸인 빈 점이에요.',
        wrong: '거기는 백이 둘 수 있어요. 흑돌에 완전히 둘러싸인 빈 점을 찾아보세요.',
        hint: '하나는 귀에 있고, 하나는 흑돌 네 개 한가운데에 있어요.',
        board: { rows: ['.X.....', 'X......', '.......', '...X...', '..X.X..', '...X...', '.......'], turn: 'W' },
      },
    ],
    summary: '놓자마자 활로가 없는 곳은 둘 수 없어요. 상대 돌을 따낼 수 있을 때만 둘 수 있어요.',
  },

  {
    id: 'L09', unit: 2, no: 9, title: '패',
    goal: '패 모양을 알아보고, 바로 되따낼 수 없다는 것을 안다',
    steps: [
      {
        type: 'explain',
        text: '흑과 백이 한 점을 서로 번갈아 따낼 수 있는 모양이 있어요. 이런 모양을 패라고 해요.',
        board: { rows: ['.XO..', 'XO+O.', '.XO..', '.....', '.....'] },
      },
      {
        type: 'move', check: 'capture',
        text: '흑 차례예요. 단수가 된 백돌 한 점을 따내 보세요.',
        right: '따냈어요. 그런데 방금 둔 흑돌도 단수가 됐어요.',
        wrong: '아쉬워요. 활로가 하나 남은 백돌을 찾아보세요.',
        hint: '흑돌 세 개에 둘러싸인 백돌의 남은 활로를 찾아보세요.',
        board: { rows: ['.XO..', 'XO*O.', '.XO..', '.....', '.....'] },
      },
      {
        type: 'forbidden', reason: 'ko',
        text: '이번에는 백 차례예요. 네모 표시 자리에 두어서 바로 되따내 보세요.',
        right: '둘 수 없어요! 바로 되따내면 같은 모양이 끝없이 되풀이되기 때문이에요.',
        board: { rows: ['.XO..', 'X#XO.', '.XO..', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'explain',
        text: '패는 다른 곳에 한 번 둔 다음에야 따낼 수 있어요. 그 다른 곳에 두는 수를 팻감이라고 해요.',
        board: { rows: ['.XO..', 'X#XO.', '.XO..', '.....', '.....'], turn: 'W' },
      },
      {
        type: 'sequence', check: 'capture', line: ['F2', 'F3', 'B6'],
        text: '백 차례예요. 먼저 동그라미 자리에 팻감을 쓰고, 흑이 받으면 패를 따내 보세요.',
        right: '따냈어요! 다른 곳에 한 번 두었기 때문에 이제는 따낼 수 있어요.',
        board: { rows: fill(7, ['.XO....', 'X#XO...', '.XO....']), turn: 'W' },
      },
      {
        type: 'choice',
        text: '패를 바로 되따낼 수 없게 정한 까닭은 무엇일까요?',
        choices: ['같은 모양이 끝없이 되풀이되니까', '흑이 먼저 두었으니까'], answer: 0,
        right: '맞아요. 서로 따내기만 하면 대국이 끝나지 않아요.',
        wrong: '바로 되따내면 판이 어떤 모양으로 돌아가는지 떠올려 보세요.',
      },
      {
        type: 'choice',
        text: '패를 다시 따내려면 어떻게 해야 할까요?',
        choices: ['다른 곳에 한 번 둔 뒤에 따내요', '기다리지 않고 바로 따내요'], answer: 0,
        right: '맞아요. 다른 곳에 두는 그 수가 팻감이에요.',
        wrong: '방금 백이 어떻게 패를 따냈는지 떠올려 보세요.',
      },
    ],
    summary: '패는 바로 되따낼 수 없어요. 다른 곳에 한 번 둔 뒤에 따낼 수 있어요.',
  },

  {
    id: 'L10', unit: 2, no: 10, title: '집',
    goal: '집과 공배를 구별하고 집을 센다',
    steps: [
      {
        type: 'explain',
        text: '내 돌로 둘러싼 빈 점을 집이라고 해요. 바둑은 집을 더 많이 지은 쪽이 이겨요.',
        board: { rows: ['++XO.', '++XO.', '++XO.', '++XO.', '++XO.'] },
      },
      {
        type: 'count', check: 'territory', color: 'B', choices: [5, 8, 10], answer: 10, unit: '집',
        text: '흑돌이 둘러싼 흑의 집은 모두 몇 집일까요?',
        right: '맞아요. 빈 점 하나가 한 집이라서 10집이에요.',
        wrong: '흑돌 왼쪽의 빈 점을 하나씩 세어 보세요.',
        board: { rows: U2_WALL5 },
      },
      {
        type: 'count', check: 'territory', color: 'W', choices: [4, 5, 10], answer: 5, unit: '집',
        text: '같은 판이에요. 백의 집은 몇 집일까요?',
        right: '맞아요. 백돌 오른쪽의 빈 점 5개가 백의 집이에요.',
        wrong: '백돌 오른쪽의 빈 점을 하나씩 세어 보세요.',
        board: { rows: U2_WALL5 },
      },
      {
        type: 'explain',
        text: '흑돌과 백돌에 모두 닿아 있는 빈 점은 누구의 집도 아니에요. 이런 곳을 공배라고 해요.',
        board: { rows: ['..X!O..', '..X!O..', '..X!O..', '..X!O..', '..X!O..', '..X!O..', '..X!O..'] },
      },
      {
        type: 'point', rule: 'neutral', need: 'one',
        text: '공배를 한 곳 눌러 보세요.',
        right: '맞아요. 흑돌과 백돌 사이에 낀 빈 점이 공배예요.',
        wrong: '거기는 한쪽 돌로만 둘러싸인 집이에요. 흑돌과 백돌 사이를 보세요.',
        hint: '흑돌 줄과 백돌 줄 사이에 낀 빈 점을 찾아보세요.',
        board: { rows: ['..X.O..', '..X.O..', '..X.O..', '..X.O..', '..X.O..', '..X.O..', '..X.O..'] },
      },
      {
        type: 'count', check: 'territory', color: 'B', choices: [4, 6, 9], answer: 6, unit: '집',
        text: '흑이 귀를 둘러쌌어요. 흑의 집은 몇 집일까요?',
        right: '맞아요. 귀에서는 판의 끝이 벽 노릇을 해 줘요.',
        wrong: '흑돌과 판 끝으로 둘러싸인 빈 점을 세어 보세요.',
        board: { rows: U2_CORNERS },
      },
      {
        type: 'count', check: 'territory', color: 'W', choices: [3, 4, 6], answer: 4, unit: '집',
        text: '같은 판이에요. 백의 집은 몇 집일까요?',
        right: '맞아요. 오른쪽 아래 귀의 4집이 백의 집이에요.',
        wrong: '백돌과 판 끝으로 둘러싸인 빈 점을 세어 보세요.',
        board: { rows: U2_CORNERS },
      },
      {
        type: 'choice', check: 'owner',
        text: '초록 점이 있는 자리는 누구의 집일까요?',
        choices: ['흑 집', '백 집', '누구의 집도 아니에요'], answer: 2,
        right: '맞아요. 아직 어느 쪽도 둘러싸지 못한 곳이에요.',
        wrong: '그 자리에서 빈 점을 따라가면 어느 색 돌을 만나는지 살펴보세요.',
        board: { rows: ['...X...', '...X...', 'XXXX...', '...+...', '....OOO', '....O..', '....O..'] },
      },
    ],
    summary: '내 돌로 둘러싼 빈 점이 집이에요. 양쪽 돌에 모두 닿은 빈 점은 공배예요.',
  },

  {
    id: 'L11', unit: 2, no: 11, title: '한 판의 끝',
    goal: '대국이 언제 끝나는지, 어떻게 승패를 가리는지 안다',
    steps: [
      {
        type: 'explain',
        text: '더 둘 곳이 없다고 생각하면 한 수 쉴 수 있어요. 두 사람이 연달아 쉬면 대국이 끝나요.',
      },
      {
        type: 'explain',
        text: '끝나면 집을 세요. 내가 따낸 돌도 하나에 한 집으로 쳐요.',
        board: { rows: U2_WALL5 },
      },
      {
        type: 'count', check: 'total', color: 'B', choices: [10, 12, 20], answer: 12, unit: '집',
        text: '흑의 집은 10집이고, 흑이 따낸 돌이 2개 있어요. 흑은 모두 몇 집일까요?',
        right: '맞아요. 집 10에 따낸 돌 2를 더해서 12집이에요.',
        wrong: '집 수에 따낸 돌 수를 더해 보세요.',
        board: { rows: U2_WALL5, captures: { B: 2 }, komi: 0 },
      },
      {
        type: 'explain',
        text: '흑은 먼저 두어서 유리해요. 그래서 백에게 덤으로 6집 반을 더해 줘요. 반 집이 있어서 비기는 일이 없어요.',
      },
      {
        type: 'count', check: 'total', color: 'W', choices: [5, 11.5, 12.5], answer: 11.5, unit: '집',
        text: '백의 집은 5집이에요. 덤 6집 반을 더하면 백은 모두 몇 집일까요?',
        right: '맞아요. 5집에 6집 반을 더해서 11집 반이에요.',
        wrong: '5에 6.5를 더해 보세요.',
        board: { rows: U2_WALL5, captures: { B: 2 }, komi: 6.5 },
      },
      {
        type: 'choice', check: 'winner',
        text: '흑은 12집, 백은 11집 반이에요. 누가 이겼을까요?',
        choices: ['흑', '백'], answer: 0,
        right: '맞아요. 흑이 반 집 차이로 이겼어요.',
        wrong: '12와 11.5 가운데 어느 쪽이 더 큰지 보세요.',
        board: { rows: U2_WALL5, captures: { B: 2 }, komi: 6.5 },
      },
      {
        type: 'choice', check: 'winner',
        text: '흑은 21집이에요. 백은 14집에 따낸 돌 1개, 덤 6집 반이 있어요. 누가 이겼을까요?',
        choices: ['흑', '백'], answer: 1,
        right: '맞아요. 백은 14, 1, 6집 반을 더해 21집 반이라서 반 집 이겼어요.',
        wrong: '백의 집, 따낸 돌, 덤을 모두 더해서 21과 견주어 보세요.',
        board: { rows: ['...XO..', '...XO..', '...XO..', '...XO..', '...XO..', '...XO..', '...XO..'], captures: { W: 1 }, komi: 6.5 },
      },
      {
        type: 'choice',
        text: '대국은 언제 끝날까요?',
        choices: ['두 사람이 연달아 쉬었을 때', '돌을 다 썼을 때'], answer: 0,
        right: '맞아요. 둘 다 더 둘 곳이 없다고 생각하면 끝나요.',
        wrong: '더 둘 곳이 없을 때 무엇을 하는지 떠올려 보세요.',
      },
    ],
    summary: '두 사람이 연달아 쉬면 끝나요. 집과 따낸 돌을 더하고, 백에게 덤 6집 반을 줘요.',
  },
];

// 2단원 미션: 끝난 판에서 죽은 돌을 골라내고 집을 센다. 표시한 돌(x, o)이 죽은 돌이다.
export const COUNT_MISSION = {
  rows: [
    '....XO...',
    '....XO...',
    '..o.XO...',
    '....XO...',
    '....XO.x.',
    '....XO...',
    '....XO...',
    '....XO...',
    '....XO...',
  ],
  komi: 6.5,
};
