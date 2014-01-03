;(function() {
	var showInstances = function(instances, selected) {
		var selectedInstance,
			listOfInstances = '<strong>Instances</strong><ul>';

		for (var i in instances) {
			var selectedClass = '';
			if (instances[i]['id'] == selected) {
				selectedInstance = instances[i];
				selectedClass = 'class="active"';
			}

			listOfInstances += '<li><a id="instance_' + instances[i]['id'] + '" href="#"' + (selectedClass) + '>' + instances[i]['version'] + '</a></li>';
		}

		listOfInstances += '</ul>';
		$('#instances').html(listOfInstances);

		$('#data_dir').html('<h3>' + selectedInstance['datadir'] + '</h3>');
	};

	var calculateLayout = function(adjacencyList) {
		// Create a new directed graph in order to calculate the layout.
		var g = new dagre.Digraph();

		/**
		 * Add nodes to the graph.
		 * The first argument is the node id.
		 * The second is metadata about the node.
		 * In this case we're going to add labels to each of our nodes.
		 */
		$.each(adjacencyList, function (key, value) {
			// Dynamically create the DIV for each node.
			var ele = $('<div>').attr('id', key).addClass('w')
				.html(value.name + (value.version ? '<br/>' + value.version : ''));

			$('#flow-demo').append(ele);

			g.addNode(key, { label: value.name,  width: parseInt(ele.css('width')), height: parseInt(ele.css('height')) });
		});

		/**
		 * Add edges to the graph.
		 * The first argument is the edge id. Here we use null to indicate that an arbitrary edge id can be assigned automatically.
		 * The second argument is the source of the edge. The third argument is the target of the edge.
		 */
		$.each(adjacencyList, function (key, value) {
			if (value.hasOwnProperty('downstream')) {
				$.each(value.downstream, function (index) {
					g.addEdge(null, key, index);
				});
			}
		});

		// Ask dagre to do the layout for these nodes and edges.
		var layout = dagre.layout().rankSep(180).run(g);

		// Get layout information.
		layout.eachNode(function(u, value) {
			$('#' + u).css({
				top: value.y,
				left: value.x
			});
			console.log(u + ' ' + JSON.stringify(value));
		});
	};

	var repaint = function(dataInstance, isId) {
		$('#flow-demo').empty();

		// The instance is the id or the name.
		var flowUrl = 'http://hue-122675.phx-os1.stratus.dev.ebay.com/df/index.php/dataflow/flow/' + (isId ? 'id/' : 'name/') + dataInstance;

		$.getJSON('js/data.json', function(data) {
			// Get central point id.
			var centralPoint = data.currentData.id;

			// Get the instances for central point.
			var centralPointInstances = data.instances;

			// Get the flow.
			var adjacencyList = data.dataArr;

			// Cache the jobs.
			var jobs = {};

			// Show the instances list for central point.
			showInstances(centralPointInstances, isId ? dataInstance : centralPoint);

			// Layout the elements.
			calculateLayout(adjacencyList);

			// Setup some defaults for jsPlumb.
			var instance = jsPlumb.getInstance({
				Endpoint : ["Dot", {radius:2}],
				HoverPaintStyle : {strokeStyle:"#1e8151", lineWidth:2},
				Container:"flow-demo"
			});

			var windows = jsPlumb.getSelector(".flow-demo .w");

			// Initialise draggable elements.
			instance.draggable(windows);

			// Suspend drawing and initialise.
			instance.doWhileSuspended(function() {
				/**
				 * Make each ".ep" div a source and give it some parameters to work with.
				 * Here we tell it to use a Continuous anchor and the StateMachine connectors, and also we give it the connector's paint style.
				 * Note that in this demo the strokeStyle is dynamically generated, which prevents us from just setting a jsPlumb.Defaults.PaintStyle.
				 * Note also here that we use the 'filter' option to tell jsPlumb which parts of the element should actually respond to a drag start.
				 */
				instance.makeSource(windows, {
					// Filter - only supported by jquery.
					//filter:".ep",
					anchor:"Continuous",
					connector:[ "StateMachine", { curviness:20 } ],
					connectorStyle:{ strokeStyle:"#5c96bc", lineWidth:2, outlineColor:"transparent", outlineWidth:4 }
				});

				// Initialise all '.w' elements as connection targets.
				instance.makeTarget(windows, {
					dropOptions:{ hoverClass:"dragHover" },
					anchor:"Continuous"
				});

				// Finally make the connections.
				$.each(adjacencyList, function (key, value) {
					$.each(value.downstream, function (index, val) {
						// Add to jobs cache.
						jobs[val.jobid] = val;

						instance.connect({
							source: key, target: index, detachable: false,
							overlays: [
								["Arrow", { location:1, id:"arrow", length:14, foldback:0.8 }],
								["Label", { label: val.jobid, id: val.jobid, cssClass:"aLabel" }]
							]
						});
					});
				});
			});

			// Mark the central endpoint.
			$('#' + centralPoint).addClass('central-point');

			$('.aLabel').each(function (i, obj) {
				// Get the label for jobid.
				var jobId = $(obj).text();
				$(obj).attr('title', 'Submit Time: ' + jobs[jobId].jobStartTime + '<br/>Finish Time: ' + jobs[jobId].jobFinishTime);
			});

			// Apply the tooltip.
			$(document).tooltip();
		});
	};

	// At first, draw the initial flow chart.
	repaint('', false);

	// Add click listener to instance.
	var demoList = $(".demo-list");
	demoList.on("click", "a", function(event) {
		event.preventDefault();

		// Just ignore if it is already active.
		if (!$(this).hasClass("active")) {
			demoList.find(".active").removeClass("active");
			$(this).parent().addClass("active");

			repaint($(this).attr('id').replace('instance_', ''), true);
		}
	});
})();
