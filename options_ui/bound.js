
/*
	このファイルはこのプロジェクト内の処理の一部を説明する目的で添付されたアーカイブである。
	このファイルは、その記述の一部を切り取って使われているが、このファイルそのものはこのプロジェクト内の他のいかなるファイルからもリンクされていない。
*/

/*
	BoundRect は Bounds の応用のひとつで ラッパー関数 BoundsRapper を通じて作成されている。
	BoundsRapper に適切な table を指定することで、任意の頂点数を設定できる可能性がある。
	ただし恐らく境界の判定は指定された値が直線を示すことを前提としてしか行われないため、実用性は不明ないしない。
	例えばもしかすると三次元以上の矩形に対して使用できるかもしれない。
*/

//立方体
function BoundCube(verteces) {
	
	var table = [
			{ position: 'x', border: 'width' },
			{ position: 'y', border: 'height' },
			{ position: 'z', border: 'depth' }
		],
		rapped;
	
	this.verteces = verteces || { x: 0, y: 0, z: 0, width: 0, height: 0, depth: 0 };
	
	rapped = new BoundsRapper(this.verteces, table);
	
	this.update = update, this.set = set, this.hit = hit, this.snap = snap, this.getBounds = getBounds;
	
	function update($rect) { rapped.update($rect); }
	function set(key, value) { this.verteces[key] = rapped.set(key, value); }
	function hit(targets) { return rapped.hit(targets); }
	function snap(targets) { return this.verteces = rapped.snap(targets); }
	function getBounds() { return rapped.bounds; }
	
}
//平面矩形
function BoundRect(rect) {
	
	var table = [ { position: 'x', border: 'width' }, { position: 'y', border: 'height' } ], rapped;
	
	this.rect = rect || { x: 0, y: 0, width: 0, height: 0 };
	
	rapped = new BoundsRapper(this.rect, table);
	
	this.update = update, this.set = set,
	this.hit = hit, this.snap = snap, this.snapOut = snapOut, this.getBounds = getBounds,
	this.getTRBL = getTRBL;
	
	/*
		update
			rect の値に直接変更を加えた時はこのメソッドを可能な限り実行する。
			bounds(=rapped) は rect の参照ではなくコピーであるため、rect への変更は bounds へは反映されない。
			このメソッドを実行することで rect の値が bounds へコピーされる。
			また、下記のメソッド set を使えば、rect への変更と bounds へのコピーが同時に行える。
			その際は update は行う必要がない。
			rect を新規に置き換える場合は第一引数に置き換えたい値を指定した rect を指定する。
		set
			rect のプロパティを個別に書き換える。
			第一引数に書き換える対象のプロパティ名、第二引数に書き換える値を指定する。
			実行すると rect だけでなく、それを基にした bounds の同名プロパティの値も書き換える。
			update よりはこちらの使用を推奨。
		hit
			第一引数 targets に指定した bounds と rect が接触しているか判定を行う。
			接触していれば true を返し、接触していなければ false を返す。
			targets には BoundRect の Bounds か、BoundRect を指定しなければならない。
		snap
			rect の境界を第一引数 targets に指定した bounds に設定する。
			rect が示す範囲が bounds の境界外に存在したり、境界外に移動しようとした場合、
			targets の bounds 内に収まるように rect の値を書き換える。
			戻り値は書き換え後の rect になる。書き換えは実際の rect の値に反映される。
		snapOut
			rect の位置を第一引数 targets に指定した bounds の境界に設定する。
			rect の位置は、rect の幅、高さを含めた範囲が targets の境界に接する範囲に制限される。
			戻り値は書き換え後の rect になる。書き換えは実際の rect の値に反映される。
		getBounds
			rect の指定に基づいて設定された bounds を返す。
			rect と bounds はどちらもお互いを参照しない。
			片方を書き換えても片方はそのままなので値の書き換えは可能な限り update か set を通じて行う。
		getTBRL
			rect の値を { top:*, right:*, bottom:*, left:* } に変換した値を返す。
	*/
	//汎用 Bounds メソッド
	function update($rect) { rapped.update($rect); }
	function set(key, value) { this.rect[key] = rapped.set(key, value); }
	function hit(targets) { return rapped.hit(targets); }
	function snap(targets) { return this.rect = rapped.snap(targets); }
	function snapOut(targets) { return this.rect = rapped.snapOut(targets); }
	function getBounds() { return rapped.bounds; }
	
	//独自メソッド
	function getTRBL($rect) {
		$rect = $rect || this.rect;
		return { top: $rect.y, right: $rect.x + $rect.width, bottom: $rect.y + $rect.height, left: $rect.x };
	}
	
}
function BoundsRapper(parameters, table) {
	
	var index = {};
	
	this.bounds,
	this.init = init, this.update = update, this.set = set, this.snap = snap, this.snapOut = snapOut, this.hit = hit;
	
	this.init();
	
	function init($parameters, $table) {
		
		parameters = $parameters || parameters, table = $table || table, this.bounds = new Bounds();
		
		for (var i = 0, l = table.length; i < l; i++) {
			this.bounds.points[i] = new Bound(parameters[table[i].position], parameters[table[i].border]);
			index[table[i].position] = { i: i, k: 'position' }, index[table[i].border] = { i: i, k: 'border' };
		}
		
	}
	function update($parameters) {
		
		parameters = $parameters || parameters;
		
		for (var i = 0, l = table.length; i < l; i++)
			this.bounds.points[i].position = parameters[table[i].position],
			this.bounds.points[i].border = parameters[table[i].border];
		
	}
	function set(key, value) { return this.bounds.points[index[key].i][index[key].k] = value; }
	
	function hit(targets) {
		return this.bounds.hit((targets.constructor == Bounds) ? targets : targets.getBounds());
	}
	function snap(targets) {
		this.bounds.snap((targets.constructor == Bounds) ? targets : targets.getBounds());
		return rap.apply(this, [ parameters ]);
	}
	function snapOut(targets) {
		this.bounds.snapOut((targets.constructor == Bounds) ? targets : targets.getBounds());
		return rap.apply(this, [ parameters ]);
	}
	
	function rap(targets) {
		var i,l,k;
		for (i = 0, l = table.length; i < l; i++) for (k in table[i]) targets[table[i][k]] = this.bounds.points[i][k];
		return targets;
	}
	
}
function Bounds(points) {
	
	this.points = points || [],
	this.snap = snap, this.snapOut = snapOut, this.hit = hit;
	
	function snap(targets) {
		for (var i = 0, l = this.points.length; i < l; i++) this.points[i].setSnapPosition(targets.points[i]);
		return this.points;
	}
	function snapOut(targets) {
		for (var i = 0, l = this.points.length; i < l; i++) this.points[i].setSnapOutPosition(targets.points[i]);
		return this.points;
	}
	function hit(targets) {
		for (var i = 0, l = this.points.length; i < l; i++) if (!this.points[i].check(targets.points[i])) return false;
		return true;
	}
	
}
function Bound(position, border) {
	
	this.position = position || 0, this.border = border || 0,
	
	this.setSnapPosition = setSnapPosition, this.setSnapOutPosition = setSnapOutPosition, this.check = check;
	
	function setSnapPosition(target) {
		return this.position = (this.position < target.position) ? target.position :
			(this.position > (target.position + target.border) - this.border) ?
				(target.position + target.border) - this.border : this.position;
	}
	function setSnapOutPosition(target) {
		return this.position = (this.position < target.position - this.border ) ? target.position - this.border :
			(this.position > target.position + target.border) ? target.position + target.border : this.position;
	}
	function check(target) {
		return Math.abs(this.position - target.position + (this.border - target.border) / 2) <=
			target.border + (this.border - target.border) / 2;
	}
	
}