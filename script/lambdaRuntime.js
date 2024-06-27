/* 
 * lambdaRuntime.js
 * MaoHuPi (c) 2024
 */

/* sketch */

/*

λ script => λ . (), step

( λ x . x ) => 1 1 1, 1
λ x . x

( λ x . x ) 1 => 1 1 1, 1
1

( ( λ x . λ y . x y ) ( λ z . z ) ) 1 => 3 3 3, 3
( λ y . ( λ z . z ) y ) 1
( λ z . z ) 1
1

// if change var
ori := λ x . x
sec := λ f . λ x . f x
( ( sec sec ) ori ) 1
( ( ( λ f . λ x . f x ) ( λ f . λ x . f x ) ) ( λ x . x ) ) 1 => 5 5 5, 5
( ( λ x . ( λ f . λ x2 . f x2 ) x ) ( λ x . x ) ) 1
( ( λ f . λ x2 . f x2 ) ( λ x . x ) ) 1
( λ x2 . ( λ x . x ) x2 ) 1
( λ x . x ) 1
1

// if don't change var
ori := λ x . x
sec := λ f . λ x . f x
( ( sec sec ) ori ) 1
( ( ( λ f . λ x . f x ) ( λ f . λ x . f x ) ) ( λ x . x ) ) 1 => 5 5 5, 5
( ( λ x . ( λ f . λ x . f x ) x ) ( λ x . x ) ) 1
( ( λ x . λ x . x x ) ( λ x . x ) ) 1
( λ x . ( λ x . x ) ( λ x . x ) ) 1
( λ x . 1 ) ( λ x . 1 )
1
// or
( ( ( λ f . λ x . f x ) ( λ f . λ x . f x ) ) ( λ x . x ) ) 1 => 5 5 5, 5
( ( λ x . ( λ f . λ x . f x ) x ) ( λ x . x ) ) 1
( ( λ f . λ x . f x ) ( λ x . x ) ) 1
( λ x . ( λ x . x ) x ) 1
( λ x . 1 ) 1
1
// or
( ( ( λ f . λ x . f x ) ( λ f . λ x . f x ) ) ( λ x . x ) ) 1 => 5 5 5, 5
( ( λ x . ( λ f . λ x . f x ) x ) ( λ x . x ) ) 1
( ( λ f . λ x . f ( λ x . x ) ) ( λ x . x ) ) 1
( λ x . ( λ x . x ) ( λ x . x ) ) 1
( λ x . ( λ x . x ) ) 1
( λ x . 1 )



( λ x . ( λ x . x ) ( λ x . x ) ) 1
( λ x . 1 ) ( λ x . 1 )
1
// 先處理外層再處理內層
---
( λ x . ( λ x . x ) ( λ x . x ) ) 1
( λ x . ( λ x . x ) ) 1
( λ x . 1 )
// 括號越內層越先做
---
( λ x0 . ( λ x1 . x1 ) ( λ x2 . x2 ) ) 1
( λ x0 . ( λ x2 . x2 ) ) 1
( λ x2 . x2 )
// 依照變數域分開同名稱的不同變數

*/

/* runtime */

const VARIABLE_SCOPE = 'field' // {field: '依照變數域分開同名稱的不同變數', child: '不分開變數域、括號越內層越先做'}
const UNION_MODE = 'left' // {left: '左結合', right: '右結合'}

class LambdaRuntimeError extends Error {
	constructor(message) {
		super(message);
		this.name = 'LambdaRuntimeError';
	}
}

class Branch {
	constructor(list = []) {
		this.list = list;
	}
	push(...arg) {
		this.list.push(...arg);
	}
	get(...indices) {
		if (indices.length == 0) return this;
		let item = this.list[indices.shift()];
		return indices.length > 0 ? item.get(...indices) : item;
	}
	length() {
		return this.list.length;
	}
	apply(value) {
		return new Branch([this, value]);
	}
	replace(param, value) {
		return new Branch(this.list.map(item => {
			if ((item instanceof Variable) && (item.name == param.name)) {
				return value;
			} else {
				return item.replace(param, value);
			}
		}));
	}
	toOperator(unionMode = 'left') {
		let list = [...(this.list)];
		let item = unionMode == 'right' ? list.pop() : list.shift();
		if (list.length == 0) return item;
		while (list.length > 0) {
			item = unionMode == 'right' ? new OperatorApply(list.pop(), item) : new OperatorApply(item, list.shift());
		}
		return item;
	}
	parse() {
		try {
			if (this.list.length == 1) return this.list[0].parse();
			let temp = this.toOperator('left');
			return temp.parse();
		} catch (error) {
			if (error instanceof RangeError) {
				throw new LambdaRuntimeError('There are a none stop combination. The code can\'t be parse with that!');
			} else {
				throw error;
			}
		}
	}
	toString() {
		return `( ${this.list.map(item => item.toString()).join(' ')} )`;
	}
}

class Lambda {
	constructor(param, calc) {
		this.parameter = param;
		this.calculate = calc; // Branch
	}
	push(...arg) {
		this.calculate.push(...arg);
	}
	get(...indices) {
		return this.calculate.get(...indices);
	}
	length() {
		return this.calculate.length ? this.calculate.length() : 1;
	}
	apply(value) {
		return this.calculate.replace(this.parameter, value).parse();
	}
	replace(param, value) {
		if (VARIABLE_SCOPE == 'child' || (VARIABLE_SCOPE == 'field' && this.parameter.name !== param.name)) {
			return new Lambda(this.parameter, this.calculate.replace(param, value));
		} else {
			return this;
		}
	}
	parse() {
		return new Lambda(this.parameter, this.calculate.parse());
	}
	toString() {
		return `( λ ${this.parameter.toString()} . ${this.calculate.toString()} )`;
	}
}

class Variable {
	constructor(name) {
		this.name = name.toString();
	}
	replace(param, value) {
		if (this.name == param.name) {
			return value;
		} else {
			return this;
		}
	}
	apply(value) {
		return new Branch([this, value]);
	}
	parse() {
		return this;
	}
	toString() {
		return this.name;
	}
}

class OperatorApply {
	constructor(a, b) {
		this.a = a;
		this.b = b;
	}
	replace(param, value) {
		return new OperatorApply(item.a.replace(param, value), item.b.replace(param, value))
	}
	apply(value) {
		return new Branch([this, value]);
	}
	parse() {
		let a = this.a.parse().parse(),
			b = this.b.parse().parse();
		return a.apply(b);
	}
	toString() {
		return `(${this.a.toString()} ${this.b.toString()})`;
	}
}

function parseLambda(lambdaScript) {
	lambdaScript = lambdaScript
		.replaceAll('(', ' ( ')
		.replaceAll(')', ' ) ')
		.replaceAll('.', ' . ')
		.replace(/ +/g, ' ')
		.replace(/^ | $/g, '');
	lambdaScript = lambdaScript.split(' ');
	let charPointer = 0;
	let parseTree = new Branch();
	let branchPointer = [];
	let lambdaLayerCounter = 0;
	while (charPointer < lambdaScript.length) {
		let c = lambdaScript[charPointer];
		if (c == '(') {
			let target = parseTree.get(...branchPointer);
			branchPointer.push(target.length());
			target.push(new Branch());
		} else if (c == ')') {
			branchPointer.pop();
			while (lambdaLayerCounter > 0) {
				branchPointer.pop();
				lambdaLayerCounter--;
			}
			lambdaLayerCounter = 0;
		} else if (c == 'λ') {
			if (lambdaScript[charPointer + 2] != '.') {
				throw new LambdaRuntimeError(`Something wrong at ${charPointer + 2}: "${[...lambdaScript].splice(charPointer + 2, 1).join(' ')}"`);
			}
			lambdaLayerCounter++;
			let target = parseTree.get(...branchPointer);
			branchPointer.push(target.length());
			target.push(new Lambda(new Variable(lambdaScript[charPointer + 1]), new Branch()));
			charPointer += 2;
		} else {
			let target = parseTree.get(...branchPointer);
			target.push(new Variable(c));
		}
		charPointer++;
	}
	return parseTree;
}

/* main */

let lambdaScript = `
ture = λ x . λ y . x
false = λ x . λ y . y
and = λ p . λ q . p q false
or = λ p . λ q . p true q
not = λ p . p false true
if = λ p . λ x . λ y . p x y
isZero = λ n . n ( λ x . false ) true
cons = λ x . λ y . λ p . if p x y
car = λ x . x true
cdr = λ x . x false

0 = λ f . λ x . ( x )
1 = λ f . λ x . ( f x )
2 = λ f . λ x . ( f ( f x ) )
3 = λ f . λ x . ( f ( f ( f x ) ) )
4 = λ f . λ x . ( f ( f ( f ( f x ) ) ) )
5 = λ f . λ x . ( f ( f ( f ( f ( f x ) ) ) ) )
6 = λ f . λ x . ( f ( f ( f ( f ( f ( f x ) ) ) ) ) )
7 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) )
8 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) ) )
9 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) ) ) )
10 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) ) ) ) )
11 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) ) ) ) ) )
12 = λ f . λ x . ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f ( f x ) ) ) ) ) ) ) ) ) ) ) )

succ = λ n . λ f . λ x . f ( n f x )
# pred = λ n . λ f . λ x . ( n ( λ g . λ h . h ( g f ) ) ) ( λ u . x ) ( λ u . u )
pred = λ n . n ( λ g . λ k . ( g 1 ) ( λ u . plus ( g k ) 1 ) k ) ( λ l . 0 ) 0
plus = λ m . λ n . λ f . λ x . m f ( n f x )
mult = λ m . λ n . λ f . m ( n f )

# succ ( succ ( succ ( succ ( succ 0 ) ) ) )
# 5

# plus 2 3
# 5

plus ( mult 2 3 ) 5
# 11

# if true 2 5
# ( ( true 2 ) 5 )
`;

function main() {
	let lambdaLines = lambdaScript.replaceAll('\r', '').split('\n').filter(line => line[0] !== '#' && line.replaceAll(' ', '') !== '');
	lambdaScript = lambdaLines.pop();
	let lambdaEntries = lambdaLines.map(line => line.split(' = ')).filter(pair => pair.length == 2)
	for (let i = 0; i < lambdaEntries.length; i++) {
		let [variable, value] = lambdaEntries[i];
		lambdaScript = lambdaScript.replaceAll(variable, ` ( ${value} ) `);
		for (let j = i+1; j < lambdaEntries.length; j++) {
			lambdaEntries[j][1] = lambdaEntries[j][1].replaceAll(variable, ` ( ${value} ) `);
		}
	}
	
	let lambdaTree = parseLambda(lambdaScript);
	let result = lambdaTree.parse().toString();
	let betaEntries = lambdaEntries.map(pair => [pair[0], parseLambda(pair[1]).parse().toString()]);
	let betaResult = result;
	betaEntries.reverse().forEach(([variable, value]) => {
		betaResult = betaResult.replaceAll(value, variable);
	});

	console.log(lambdaTree.toString());
	console.log(result);
	console.log(betaResult);
}
main();