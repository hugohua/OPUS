# 08 Vocabulary

## 1. 页面目标

- 支持搜索、筛选、排序、浏览 FSRS 词表，并进入词条详情。

## 2. Web 现状映射

- `app/vocabulary/page.tsx`
- `components/vocabulary/vocabulary-list.tsx`
- `actions/get-vocab-list.ts`

## 3. 交互流与状态流

- 首屏加载词表。
- 用户通过搜索、标签、状态、排序缩小结果。
- 点击词条进入详情 sheet 或二级页。

## 4. 数据模型 / API 契约

- `GET /api/mobile/v1/vocab/list`
- `GET /api/mobile/v1/vocab/:id`
- `GET /api/mobile/v1/vocab/tags`

## 5. 边界与失败场景

- 分页参数映射、详情字段补齐、空结果和网络错误必须可区分。

## 6. 测试用例

- 搜索、筛选、排序、分页、详情跳转、空态。

## 7. 待确认问题

- 详情优先用 sheet 还是 push 二级页。
