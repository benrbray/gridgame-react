import * as React from "react";
import * as ReactDOM from "react-dom";

// Fix React events inside shadow DOM
// https://github.com/spring-media/react-shadow-dom-retarget-events
import retargetEvents from "react-shadow-dom-retarget-events";

// fake console (for mobile debugging) -------------------------------

let enableFakeConsole = false;
if (enableFakeConsole) {
	let fakeConsole = document.getElementById("console");

	let old_log = console.log;

	console.log = function (...args: any[]) {
		old_log(...args);
		let elt = document.createElement("div");
		elt.innerText = args.map((v, k) => String(v)).join(" ");
		if (fakeConsole) {
			fakeConsole.appendChild(elt);
			fakeConsole.scrollTop = fakeConsole.scrollHeight;
		}
	};
	console.error = console.debug = console.info = console.log;
}

// helper functions --------------------------------------------------

// range(1,5) returns [1,2,3,4]
const range = (a: number, b?: number): number[] => {
	if (b === undefined) { return Array.from({ length: a }, (v, k) => k); }
	else { return Array.from({ length: b - a }, (v: any, k: number) => k + a); }
};

function clone2dArray<T>(arr: Array<Array<T>>): Array<Array<T>> {
	return arr.map((row, idx) => row.slice());
};

function mod(a: number, b: number): number {
	return ((a % b) + b) % b;
};

// enums -------------------------------------------------------------

enum Key {
	BACKSPACE = 8, TAB = 9,
	LEFT = 37, RIGHT = 39, UP = 38, DOWN = 40,
	DELETE = 46,
	PERIOD = 190
};

// init --------------------------------------------------------------

export function init() {
	// define web component; usable as <grid-game></grid-game>
	customElements.define("grid-game", GridGameElement);
}

// <style> -----------------------------------------------------------
let gridStyle = /*css*/`
	grid-game {
		display: inline-block;
		contain: content;
		margin: 0 auto;
		font-size: 2rem;

		--cell-size: 2em;
		--cell-background-rgb: 255,255,255;
		--cell-background-alpha: 1.0;
		--fade-color: white;
	}
	#board {
		display: table;
		margin: auto;
		border: 2px solid black;
		user-select: none;
		border-collapse: collapse;
	}
	.board-row {display: table-row; }

	@keyframes flicker {
		0 % { opacity: 1.0; background- color: #aaa; }
		100% {opacity: 1.0; background-color: black;}
	}

	.cell                {--fadex: 1.10; }
	.cell:nth-child(2n)  {--fadex: 0.90; }
	.cell:nth-child(3n)  {--fadex: 1.32; }
	.cell:nth-child(4)   {--fadex: 0.82; }
	.cell:nth-child(5n)  {--fadex: 1.06; }
	.cell:nth-child(7n)  {--fadex: 1.14; }

	.board-row               {--fadey:  1.03; }
	.board-row:nth-child(2n) {--fadey:  1.11; }
	.board-row:nth-child(3n) {--fadey:  0.87; }
	.board-row:nth-child(4)  {--fadey:  1.00; }
	.board-row:nth-child(5n) {--fadey:  1.20; }
	.board-row:nth-child(7n) {--fadey:  1.03; }

	grid-game.loading .cell {
		/* loading animation */
		animation: flicker calc(1.4s*var(--fadex)*var(--fadey)) ease alternate infinite;
		animation-delay: calc(-1s * (var(--fadex) + var(--fadey)));
	}

	.cell {
		display: table-cell;
		position: relative;
		width: var(--cell-size);
		height: var(--cell-size);
		text-align: center;
		vertical-align: middle;
		border: 1px solid #aaa;
		user-select: none;

		background-color: rgba(var(--cell-background-rgb), var(--cell-background-alpha));

		/* Fix Firefox Render Issue (https://stackoverflow.com/a/16337203) */
		background-clip: padding-box;
	}

	.cell input {
		position: absolute;
		box-sizing: border-box;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;

		font-size: inherit;

		text-align: center;
		border: none;

		caret-color: transparent;
		user-select: none;
		cursor: default;
	}
	.cell input::selection {
		color: inherit;
		background-color: inherit;
	}

	.cell input.void {
		background-color: black;
		border: none;
	}
	.cell input.disabled {
		background-color: gray;
	}
	.cell input.highlight:not([disabled]) {
		background-color: lightblue;
	}
	.cell input:focus, .cell input.highlight:focus {
		background-color: #8cbaca;
	}`;
// </style> ----------------------------------------------------------

//// WEB COMPONENT ///////////////////////////////////////////////////

export class GridGameElement extends HTMLElement {
	constructor() {
		super();
		console.log("gridgame :: constructor");

		// build template
		let template = document.createElement("div");

		// TODO: less hacky CSS solution?
		let styleElt = document.createElement("style");
		styleElt.innerHTML = gridStyle;
		template.appendChild(styleElt);

		// react root
		let rootElt = document.createElement("div");
		template.appendChild(rootElt);

		// attach template as shadow dom
		//let shadowRoot = this.attachShadow({mode: "open" });
		this.appendChild(template);
		ReactDOM.render(
			<GridGame numRows={4} numCols={4} />,
			rootElt
		);

		// workaround for react event issues inside shadow dom
		//retargetEvents(shadowRoot);
	}
}

//// REACT COMPONENTS ////////////////////////////////////////////////

// <GridGame /> ------------------------------------------------------

interface IGridGameProps {
	numRows: number;
	numCols: number;
}

interface IGridGameState {
	numRows: number;
	numCols: number;
	board: string[][];
	disabled: boolean;
	focusCoords: { row: number, col: number; } | null;
}

interface GridCoord {
	row: number,
	col: number;
}

export class GridGame extends React.Component<IGridGameProps, IGridGameState> {

	/* ---- Constructor ---- */
	constructor(props: IGridGameProps) {
		super(props);

		// TODO: bind event handlers
		this.handleBeforeInput = this.handleBeforeInput.bind(this);
		this.handleInput = this.handleInput.bind(this);
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleFocus = this.handleFocus.bind(this);

		// set state
		this.state = {
			numRows: props.numRows,
			numCols: props.numCols,
			board: range(props.numRows).map((k, v) =>
				range(props.numCols).map((k, v) => "")
			),
			disabled: false,
			focusCoords: null
		};
	}

	/* ---- Render ---- */

	render() {
		return (<div id="board" tabIndex={0}>
			{range(this.state.numRows).map((v, row) =>
				<div className="board-row">
					{range(this.state.numCols).map((v, col) => {
						let shouldFocus: boolean =
							(row == this.state.focusCoords?.row)
							&& (col == this.state.focusCoords?.col);
						return (<GridCell
							value={this.state.board[row][col]}
							handleInput={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleInput(evt, row, col)}
							handleBeforeInput={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleBeforeInput(evt, row, col)}
							handleKeyDown={(evt) => this.handleKeyDown(evt, row, col)}
							handleFocus={(evt) => this.handleFocus(evt, row, col)}
							focus={shouldFocus}
						/>);
					})}
				</div>
			)}
		</div>);
	}

	/* ---- Coordinate Computations ---- */

	coordNext(row: number, col: number): GridCoord {
		if (col + 1 >= this.state.numCols) {
			return { row: mod(row + 1, this.state.numRows), col: mod(col + 1, this.state.numCols) };
		} else {
			return { row: row, col: col + 1 };
		}
	}

	coordPrev(row: number, col: number): GridCoord {
		if (col - 1 < 0) {
			return { row: mod(row - 1, this.state.numRows), col: mod(col - 1, this.state.numCols) };
		} else {
			return { row: row, col: col - 1 };
		}
	}

	/* ---- Focus Management ---- */

	focusUp = () => this.focusRelativeWrap(-1, 0);
	focusDown = () => this.focusRelativeWrap(+1, 0);
	focusLeft = () => this.focusRelativeWrap(0, -1);
	focusRight = () => this.focusRelativeWrap(0, +1);

	focusRelativeWrap(dx: number, dy: number) {
		if (this.state.focusCoords == null) { return; }
		let { row, col } = this.state.focusCoords;
		this.setState({
			focusCoords: {
				row: mod(row + dx, this.state.numRows),
				col: mod(col + dy, this.state.numCols)
			}
		});
	}

	focusNext() {
		if (this.state.focusCoords == null) { return; }
		// compute next position
		let { row, col } = this.state.focusCoords;
		this.setState({ focusCoords: this.coordNext(row, col) });
	}

	focusPrev() {
		if (this.state.focusCoords == null) { return; }
		// compute prev position
		let { row, col } = this.state.focusCoords;
		this.setState({ focusCoords: this.coordPrev(row, col) });
	}

	//// ACTIONS /////////////////////////////////////////////////////

	boardDelete(row: number, col: number) {
		let newBoard = clone2dArray(this.state.board);
		newBoard[row][col] = "";
		this.setState({
			board: newBoard
		});
	}

	boardInsert(value: string, row?: number, col?: number, focus: boolean = true) {
		// default to currently focused cell
		if (row === undefined || col === undefined) {
			if (this.state.focusCoords) {
				if (row === undefined) { row = this.state.focusCoords.row; }
				if (col === undefined) { col = this.state.focusCoords.col; }
			} else {
				return;
			}
		}

		// normalize input
		// TODO: support for input restrictions (A-Z, 0-9, etc.)
		value = value.toUpperCase();

		// insert into board, as if typing
		let board = clone2dArray(this.state.board);
		let [nextRow, nextCol] = [row, col];
		for (let k = 0; k < value.length; k++) {
			board[nextRow][nextCol] = value[k];
			// get next cell, as if typing
			let nextCoord = this.coordNext(nextRow, nextCol);
			nextRow = nextCoord.row;
			nextCol = nextCoord.col;
		}

		// optionally set focus
		if (focus) {
			this.setState({
				board: board,
				focusCoords: { row: nextRow, col: nextCol }
			});
		} else {
			this.setState({ board });
		}
	}

	//// EVENT HANDLERS //////////////////////////////////////////////

	/* ---- Event Handlers ---- */

	handleBeforeInput(evt: React.ChangeEvent<HTMLInputElement>, row: number, col: number) {
		// InputEvents don't consistently provide information about the
		// exact changes made, so always clear the input field first
		let target = (evt.target as HTMLInputElement);
		if (target) { target.value = ""; }
	}

	handleInput(evt: React.ChangeEvent<HTMLInputElement>, row: number, col: number) {
		// TODO: should we always prevent default?
		evt.preventDefault();

		// cast, since we know what type of event to expect
		// TODO: handle browsers like Safari/IE which don't have InputEvents
		let target = (evt.target as HTMLInputElement);
		let inputEvent = (evt.nativeEvent as InputEvent);

		// handle delete input types
		switch (inputEvent.inputType) {
			case "deleteContentBackward":
				this.boardDelete(row, col);
				this.focusPrev();
				return;
			case "deleteContentForward":
				this.boardDelete(row, col);
				this.focusNext();
				return;
		}

		// get new value
		let newValue = inputEvent.data || target.value;
		if (!newValue || newValue.length == 0) { return; }
		this.boardInsert(newValue, row, col);
	}

	handleFocus(evt: React.FocusEvent, row: number, col: number) {
		this.setState({ focusCoords: { row, col } });
	}

	handleKeyDown(evt: React.KeyboardEvent, row: number, col: number) {
		// TODO: preventDefault() will prevent cells from firing
		//       an oninput event! make decision later
		//evt.preventDefault();

		// ignore when inactive or disabled
		if (this.state.disabled) { return; }
		if (this.state.focusCoords == null) { return; }
		// TODO: won't this cell automatically be the one focused?
		// assert(this.state.focusCoords == (row, col))

		// TODO: alphanumeric?
		if (evt.keyCode == Key.BACKSPACE) {
			this.boardDelete(row, col);
			this.focusPrev();
			evt.preventDefault();
		}
		if (evt.keyCode == Key.DELETE) {
			this.boardDelete(row, col);
			this.focusNext();
			evt.preventDefault();
		}

		// handle arrow keys
		if (evt.keyCode == Key.LEFT) { this.focusPrev(); }
		if (evt.keyCode == Key.RIGHT) { this.focusNext(); }
		if (evt.keyCode == Key.UP) { this.focusUp(); }
		if (evt.keyCode == Key.DOWN) { this.focusDown(); }
	}
}

// <GridCell /> ------------------------------------------------------

interface IGridCellProps {
	value: string;
	focus?: boolean;
	handleInput: React.ChangeEventHandler<HTMLInputElement>;
	handleBeforeInput: React.ChangeEventHandler<HTMLInputElement>;
	handleKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
	handleFocus: React.FocusEventHandler<HTMLInputElement>;
}

function GridCell(props: IGridCellProps) {
	const inputElt = React.useRef<HTMLInputElement>(null);

	// focus <input> whenever `focus` prop present
	React.useEffect(() => {
		if (props.focus) { inputElt.current?.focus(); }
	});

	return (
		<div className="cell">
			<input
				type="text"
				autoComplete="plz-dont-autofill"
				onInput={props.handleInput}
				onBeforeInput={props.handleBeforeInput}
				onKeyDown={props.handleKeyDown}
				onFocus={props.handleFocus}
				value={props.value}
				ref={inputElt}
			/>
		</div>
	);
};