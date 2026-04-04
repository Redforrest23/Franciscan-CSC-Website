/**
 * PrereqTree
 *
 * Renders a simple SVG tree showing a course's prerequisite chain.
 * Each node shows the course code, colored by completion status.
 *
 * Props:
 *   course       - the target course object from courses.json
 *   allCourses   - full courses array
 *   completedSet - Set<string> of completed course IDs
 */

const NODE_W = 100
const NODE_H = 36
const H_GAP = 40  // horizontal gap between columns
const V_GAP = 20  // vertical gap between nodes in same column

/**
 * Recursively builds a tree structure from prereqs.
 * Returns { course, children[] }
 */
function buildTree(courseId, allCourses, visited = new Set()) {
  if (visited.has(courseId)) return null
  visited.add(courseId)

  const course = allCourses.find((c) => c.id === courseId)
  if (!course) return null

  const children = course.prerequisites
    .map((prereqId) => buildTree(prereqId, allCourses, new Set(visited)))
    .filter(Boolean)

  return { course, children }
}

/**
 * Assigns x/y positions to each node in the tree.
 * Root (the target course) is on the right; prereqs branch left.
 */
function layoutTree(node, depth = 0, offsetY = { value: 0 }) {
  if (!node) return []

  const nodes = []

  // Layout children first (they go to the left)
  const childLayouts = node.children.map((child) => layoutTree(child, depth + 1, offsetY))

  const childNodes = childLayouts.flat()
  const childrenOfThisNode = childLayouts
    .map((layout) => layout.find((n) => n.depth === depth + 1))
    .filter(Boolean)

  // Y position: center over children, or use current offset
  let y
  if (childrenOfThisNode.length > 0) {
    const minY = Math.min(...childrenOfThisNode.map((n) => n.y))
    const maxY = Math.max(...childrenOfThisNode.map((n) => n.y))
    y = (minY + maxY) / 2
  } else {
    y = offsetY.value
    offsetY.value += NODE_H + V_GAP
  }

  nodes.push({ course: node.course, depth, y })
  return [...childNodes, ...nodes]
}

export default function PrereqTree({ course, allCourses, completedSet }) {
  if (!course) return null

  const tree = buildTree(course.id, allCourses)
  if (!tree) return null

  const offsetY = { value: 0 }
  const nodes = layoutTree(tree, 0, offsetY)

  if (nodes.length <= 1) {
    return (
      <p className="text-sm text-gray-400 italic">
        {course.code} has no prerequisites.
      </p>
    )
  }

  // Normalize so shallowest depth = leftmost column
  const maxDepth = Math.max(...nodes.map((n) => n.depth))
  const minY = Math.min(...nodes.map((n) => n.y))

  const positioned = nodes.map((n) => ({
    ...n,
    x: (maxDepth - n.depth) * (NODE_W + H_GAP),
    y: n.y - minY + 10,
  }))

  const svgWidth = (maxDepth + 1) * (NODE_W + H_GAP)
  const svgHeight = offsetY.value + 20

  // Build edges: connect each node to its children
  const edges = []
  nodes.forEach((n) => {
    const parent = positioned.find((p) => p.course.id === n.course.id)
    n.course.prerequisites.forEach((prereqId) => {
      const child = positioned.find((p) => p.course.id === prereqId)
      if (parent && child) {
        edges.push({ from: child, to: parent })
      }
    })
  })

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="font-sans text-xs"
        style={{ minWidth: svgWidth }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const x1 = edge.from.x + NODE_W
          const y1 = edge.from.y + NODE_H / 2
          const x2 = edge.to.x
          const y2 = edge.to.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
          )
        })}

        {/* Nodes */}
        {positioned.map((node) => {
          const done = completedSet?.has(node.course.id)
          const isTarget = node.course.id === course.id

          const fill = isTarget
            ? '#2563eb'
            : done
            ? '#dcfce7'
            : '#f9fafb'

          const stroke = isTarget
            ? '#1d4ed8'
            : done
            ? '#86efac'
            : '#e5e7eb'

          const textColor = isTarget ? '#ffffff' : '#111827'

          return (
            <g key={node.course.id} transform={`translate(${node.x}, ${node.y})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize={11}
                fontWeight={isTarget ? 600 : 400}
              >
                {node.course.code}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-blue-600" /> Selected course
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-gray-50 border border-gray-200" /> Not yet completed
        </span>
      </div>
    </div>
  )
}
